import { prisma } from "@/server/db";
import { authOptions } from "@/server/auth";
import { getServerSession } from "next-auth/next";
import { config } from "@/server/config";
import { logError, logWarn } from "@/server/log";
import { checkRouteRateLimit } from "@/server/route-rate-limit";
import { buildChartPalette, getBrandingSettings, getThemeCssVars } from "@/server/settings";
import { getReportsDashboard, normalizeReportsFilters } from "@/server/reports";
import { renderPdfResponse } from "@/server/pdf";
import { hasHrAddon, isManagerRole } from "@/server/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMin(minutes: number) {
  const min = Math.max(0, Math.floor(Number(minutes || 0)));
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

function hexToRgb(hex: string) {
  const m = String(hex || "").trim().replace("#", "");
  const normalized =
    /^[0-9a-fA-F]{3,4}$/.test(m)
      ? `${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
      : /^[0-9a-fA-F]{6,8}$/.test(m)
        ? m.slice(0, 6)
        : null;
  if (!normalized) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgbaFromHex(hex: string, alpha: number, fallback: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  const a = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function donutSvg(items: Array<{ type: string; minutes: number }>, palette: string[]) {
  const data = (items || []).filter((x) => Number(x.minutes || 0) > 0).slice(0, 12);
  const total = data.reduce((s, x) => s + Number(x.minutes || 0), 0);
  const resolvedPalette = palette.length ? palette : ["#F05123"];

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 30;
  const r = (size - stroke) / 2;

  if (!total) {
    return `<div class="muted">No data.</div>`;
  }

  const gap = 2.2;
  let angle = 0;
  const slices = data.map((x, i) => {
    const value = Number(x.minutes || 0);
    const sweep = (value / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle += sweep;
    const hasGap = sweep > gap * 1.15;
    const color = resolvedPalette[i % resolvedPalette.length];
    return {
      ...x,
      start: hasGap ? start + gap / 2 : start,
      end: hasGap ? end - gap / 2 : end,
      color,
      pct: total ? Math.round((value / total) * 1000) / 10 : 0
    };
  });

  const legend = slices
    .map(
      (s) => `
      <div class="legendRow">
        <span class="sw" style="background:${esc(s.color)}"></span>
        <span class="lbl">${esc(s.type)}</span>
        <span class="val">${esc(s.minutes)}m <span class="pct">(${esc(s.pct)}%)</span></span>
      </div>`
    )
    .join("");

  const arcs = slices
    .map(
      (s) =>
        `<path d="${esc(describeArc(cx, cy, r, s.start, s.end))}" stroke="${esc(s.color)}" stroke-width="${stroke}" fill="none" stroke-linecap="round" />`
    )
    .join("");

  return `
    <div class="chartWrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}" />
        ${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="900" fill="#fff">
          ${esc(Math.round((total / 60) * 100) / 100)}h
        </text>
        <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.75)">
          ${esc(total)} min
        </text>
      </svg>
      <div class="legend">${legend}</div>
    </div>
  `;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, hrAddon: true, status: true, team: { select: { name: true } }, position: true }
  });
  if (!actor || actor.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });

  const rateLimit = checkRouteRateLimit({
    request: req,
    scope: "reports-dashboard-pdf",
    actorId: actor.id,
    limit: config.pdf.routeLimitPerMinute
  });
  if (!rateLimit.ok) {
    logWarn("reports.pdf.rate_limited", { requestId: rateLimit.requestId, actorId: actor.id });
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "x-request-id": rateLimit.requestId
      }
    });
  }

  const url = new URL(req.url);
  const fromIso = url.searchParams.get("fromIso") ?? "";
  const toIso = url.searchParams.get("toIso") ?? "";
  const teamName = url.searchParams.get("teamName");
  const position = url.searchParams.get("position");
  const employeeEmail = url.searchParams.get("employeeEmail");

  const rawFilters = {
    fromIso,
    toIso,
    teamName: teamName && teamName !== "ALL" ? teamName : null,
    position: position && position !== "ALL" ? position : null,
    employeeEmail: employeeEmail && employeeEmail !== "ALL" ? employeeEmail : null
  };

  const filters = normalizeReportsFilters(rawFilters);

  const actorForQuery = { id: actor.id, email: actor.email, role: actor.role, hrAddon: actor.hrAddon ?? false };
  const dash = await getReportsDashboard({
    actor: actorForQuery,
    filters: {
      fromIso: filters.fromIso,
      toIso: filters.toIso,
      teamName: filters.teamName,
      position: filters.position,
      employeeEmail: filters.employeeEmail
    }
  });

  const branding = await getBrandingSettings();
  const theme = await getThemeCssVars();
  const palette = buildChartPalette(theme as any);
  const secondaryColor = palette[0] || "#F05123";
  const font = (theme as any)["--color-font-main"] as string | undefined;
  const font2 = (theme as any)["--color-font-secondary"] as string | undefined;
  const dark1 = (theme as any)["--color-dark-1"] as string | undefined;
  const dark2 = (theme as any)["--color-dark-2"] as string | undefined;
  const targetLabelParts: string[] = [];
  if (!isManagerRole(actor.role) && !hasHrAddon({ role: actor.role, hrAddon: actor.hrAddon ?? false })) {
    targetLabelParts.push(actor.name || actor.email);
  } else if (filters.employeeEmail) {
    const target = await prisma.user.findUnique({
      where: { email: filters.employeeEmail },
      select: { name: true, email: true, team: { select: { name: true } }, position: true }
    });
    if (target) {
      targetLabelParts.push(target.name || target.email);
      if (target.team?.name) targetLabelParts.push(target.team.name);
      if (target.position) targetLabelParts.push(target.position);
    } else {
      targetLabelParts.push(filters.employeeEmail);
    }
  } else if (filters.teamName) {
    targetLabelParts.push(filters.teamName);
  } else {
    targetLabelParts.push("ALL");
  }

  const targetLabel = targetLabelParts.filter(Boolean).join(" · ");

  const topMostRows = dash.topMost
    .map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.type)}</td><td style="text-align:right">${esc(fmtMin(x.minutes))}</td></tr>`)
    .join("");
  const topLeastRows = dash.topLeast
    .map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.type)}</td><td style="text-align:right">${esc(fmtMin(x.minutes))}</td></tr>`)
    .join("");
  const chartRows = dash.chart
    .slice(0, 25)
    .map((x) => `<tr><td>${esc(x.type)}</td><td style="text-align:right">${esc(fmtMin(x.minutes))}</td></tr>`)
    .join("");

  const logoUrl = branding.logoUrl ? esc(branding.logoUrl) : "";
  const subtitleText = branding.subtitle ? esc(branding.subtitle) : "Daily Reporting Manager";
  const bgGlow = rgbaFromHex(secondaryColor, 0.18, "rgba(240, 81, 35, 0.18)");
  const bgOk = rgbaFromHex("#1E8E6A", 0.14, "rgba(30, 142, 106, 0.14)");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Segoe UI, Roboto, Arial, sans-serif;
      margin: 0;
      padding: 22px;
      background:
        radial-gradient(900px 600px at 18% -12%, ${esc(bgGlow)} 0%, transparent 58%),
        radial-gradient(760px 520px at 90% 8%, ${esc(bgOk)} 0%, transparent 60%),
        linear-gradient(180deg, ${esc(dark2 || "#14141c")} 0%, ${esc(dark1 || "#0b0b0f")} 65%, ${esc(dark1 || "#0b0b0f")} 100%);
      color: ${esc(font || "#e4eef0")};
    }
    .muted { color: ${esc(font2 || "#a0a7a8")}; }
    .wrap { max-width: 980px; margin: 0 auto; }
    .header { border-radius: 20px; overflow: hidden; background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)), rgba(0,0,0,0.20); box-shadow: 0 18px 70px rgba(0,0,0,0.45); }
    .accent { height: 6px; background: ${esc(secondaryColor)}; }
    .headerInner { padding: 16px; display:flex; justify-content:space-between; gap: 16px; }
    .brand { display:flex; align-items:center; gap: 14px; }
    .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 16px; background: transparent; border: none; padding: 0; filter: drop-shadow(0 18px 44px rgba(0,0,0,0.55)); }
    .title { font-size: 19px; font-weight: 950; letter-spacing: -0.02em; text-transform: uppercase; }
    .sub { margin-top: 4px; font-size: 12px; letter-spacing: 0.2px; }
    .badge { display:inline-block; padding: 6px 10px; border-radius: 999px; background: ${esc(rgbaFromHex(secondaryColor, 0.16, "rgba(240,81,35,0.16)"))}; color: #fff; font-weight: 900; border: 1px solid ${esc(rgbaFromHex(secondaryColor, 0.3, "rgba(240,81,35,0.3)"))}; }
    .card { border-radius: 18px; padding: 14px; margin-top: 12px; background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(0,0,0,0.16); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .section { font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; font-size: 12px; margin-bottom: 10px; }
    .kpi { display:grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .k { padding: 10px; border-radius: 14px; border-left: 3px solid ${esc(secondaryColor)}; background: rgba(0,0,0,0.22); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .k b { display:block; font-size: 16px; }
    .k span { color: ${esc(font2 || "#a0a7a8")}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; }
    th { text-align: left; color: ${esc(font2 || "#a0a7a8")}; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
    .chartWrap { display: grid; grid-template-columns: 280px 1fr; gap: 12px; align-items: center; }
    .legend { display:flex; flex-direction:column; gap: 8px; }
    .legendRow { display:grid; grid-template-columns: 14px 1fr auto; gap: 10px; align-items:center; }
    .sw { width: 12px; height: 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12); }
    .lbl { font-size: 12px; color: rgba(255,255,255,0.92); }
    .val { font-size: 12px; color: ${esc(font2 || "#a0a7a8")}; font-variant-numeric: tabular-nums; }
    .pct { opacity: 0.75; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="accent"></div>
      <div class="headerInner">
        <div>
          <div class="brand">
            ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ""}
            <div>
              <div class="title">${esc(branding.title)}</div>
              <div class="sub muted">${subtitleText}</div>
            </div>
          </div>
          <div class="sub muted" style="margin-top:10px;"><b>Target:</b> ${esc(targetLabel)}</div>
          <div class="sub muted">Period: <span class="badge">${esc(filters.fromIso)} → ${esc(filters.toIso)}</span></div>
        </div>
        <div class="sub muted">Generated: ${esc(new Date().toLocaleString("en-GB"))}</div>
      </div>
    </div>

    <div class="card">
      <div class="section">KPI</div>
      <div class="kpi">
        <div class="k"><b>${esc(dash.totals.totalHours)}</b><span>Total hours</span></div>
        <div class="k"><b>${esc(dash.totals.totalMinutes)}</b><span>Total minutes</span></div>
        <div class="k"><b>${esc(dash.totals.daysCount)}</b><span>Days</span></div>
        <div class="k"><b>${esc(dash.totals.activitiesCount)}</b><span>Activities</span></div>
        <div class="k"><b>${esc(dash.totals.distinctTypes)}</b><span>Distinct types</span></div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="section">Top 5 — most time</div>
        <table>
          <thead><tr><th>#</th><th>Activity</th><th style="text-align:right">Time</th></tr></thead>
          <tbody>${topMostRows || ""}</tbody>
        </table>
        ${donutSvg(dash.topMost, palette)}
      </div>
      <div class="card">
        <div class="section">Top 5 — least time</div>
        <table>
          <thead><tr><th>#</th><th>Activity</th><th style="text-align:right">Time</th></tr></thead>
          <tbody>${topLeastRows || ""}</tbody>
        </table>
        ${donutSvg(dash.topLeast, palette)}
      </div>
    </div>

    <div class="card">
      <div class="section">All activities (minutes)</div>
      <table>
        <thead><tr><th>Activity</th><th style="text-align:right">Time</th></tr></thead>
        <tbody>${chartRows || ""}</tbody>
      </table>
      ${donutSvg(dash.chart, palette)}
    </div>
  </div>
</body>
</html>`;

  const filenameSafe = `DailyReporting_${filters.fromIso || "from"}_${filters.toIso || "to"}.pdf`.replaceAll(" ", "_");

  try {
    return await renderPdfResponse({ html, filename: filenameSafe, requestId: rateLimit.requestId });
  } catch (error) {
    logError("reports.pdf.failed", error, {
      requestId: rateLimit.requestId,
      actorId: actor.id,
      fromIso: filters.fromIso,
      toIso: filters.toIso
    });
    return new Response(`PDF export failed: ${String((error as any)?.message || error)}`, {
      status: 500,
      headers: { "x-request-id": rateLimit.requestId }
    });
  }
}
