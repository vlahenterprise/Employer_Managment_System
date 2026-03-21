import { prisma } from "@/server/db";
import { authOptions } from "@/server/auth";
import { getServerSession } from "next-auth/next";
import { getBrandingSettings, getThemeCssVars } from "@/server/settings";
import { APP_TIMEZONE, getAppSettings } from "@/server/app-settings";
import { getPerformanceEvaluationDetail } from "@/server/performance";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { formatInTimeZone } from "@/server/time";
import { renderPdfResponse } from "@/server/pdf";

export const runtime = "nodejs";

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHexColor(value: unknown, fallback: string) {
  const v = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) return v;
  return fallback;
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

function safeFilename(value: string) {
  return String(value || "")
    .trim()
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "_")
    .replaceAll(/_+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 160);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true }
  });
  if (!actor || actor.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const evalId = String(url.searchParams.get("evalId") ?? "").trim();
  if (!evalId) return new Response("Missing evalId", { status: 400 });

  const detail = await getPerformanceEvaluationDetail({ id: actor.id, role: actor.role }, evalId);
  if (!detail.ok) {
    if (detail.error === "NO_ACCESS") return new Response("Forbidden", { status: 403 });
    return new Response("Not found", { status: 404 });
  }

  const [app, branding, theme] = await Promise.all([getAppSettings(), getBrandingSettings(), getThemeCssVars()]);
  const lang = getRequestLang();
  const t = getI18n(lang);

  const sec = (theme as any)["--color-secondary"] as string | undefined;
  const secondaryColor = safeHexColor(sec, "#F05123");
  const ok = (theme as any)["--color-ok"] as string | undefined;
  const okColor = safeHexColor(ok, "#1E8E6A");
  const font = (theme as any)["--color-font-main"] as string | undefined;
  const font2 = (theme as any)["--color-font-secondary"] as string | undefined;
  const dark1 = (theme as any)["--color-dark-1"] as string | undefined;
  const dark2 = (theme as any)["--color-dark-2"] as string | undefined;
  const bgGlow = rgbaFromHex(secondaryColor, 0.18, "rgba(240, 81, 35, 0.18)");
  const bgOk = rgbaFromHex(okColor, 0.14, "rgba(30, 142, 106, 0.14)");

  const e = detail.evaluation;
  const startIso = formatInTimeZone(e.periodStart, APP_TIMEZONE, "yyyy-MM-dd");
  const endIso = formatInTimeZone(e.periodEnd, APP_TIMEZONE, "yyyy-MM-dd");
  const generatedAt = new Date().toLocaleString(lang === "sr" ? "sr-RS" : "en-GB");
  const logoUrl = branding.logoUrl ? esc(branding.logoUrl) : "";

  const wP = Math.max(0, Math.min(100, Number(app.PerformancePersonalWeight || 30)));
  const wG = Math.max(0, Math.min(100, Number(app.PerformanceGoalsWeight || 70)));

  const goalsRows = e.goals
    .map((g) => {
      const w = Math.round(Number(g.weight || 0) * 10) / 10;
      const selfPct = g.employeeScore != null ? Math.round(Number(g.employeeScore || 0) * 10) / 10 : "";
      const mgrPct = g.managerScore != null ? Math.round(Number(g.managerScore || 0) * 10) / 10 : "";
      return `<tr>
        <td>
          <div class="tt">${esc(g.title)}</div>
          ${g.description ? `<div class="muted small">${esc(g.description)}</div>` : ""}
        </td>
        <td style="text-align:right">${esc(w)}%</td>
        <td style="text-align:right">${esc(selfPct)}</td>
        <td>${esc(g.employeeComment || "")}</td>
        <td style="text-align:right">${esc(mgrPct)}</td>
        <td>${esc(g.managerComment || "")}</td>
      </tr>`;
    })
    .join("");

  const personalRows = e.personalItems
    .map((p) => {
      const rating = p.managerRating != null ? Math.round(Number(p.managerRating || 0) * 10) / 10 : "";
      return `<tr>
        <td style="width:34px">#${esc(p.qNo)}</td>
        <td>
          <div class="tt">${esc(p.area)}</div>
          <div class="muted small">${esc(p.description)}</div>
          <div class="muted small"><b>${esc(t.performance.scale)}:</b> ${esc(p.scale)}</div>
        </td>
        <td style="text-align:right; width:80px">${esc(rating)}</td>
        <td>${esc(p.managerComment || "")}</td>
      </tr>`;
    })
    .join("");

  const scoresHtml =
    e.finalScore != null
      ? `<div class="kpi">
          <div class="k"><b>${esc(Math.round(Number(e.finalScore || 0) * 10) / 10)}</b><span>${esc(t.performance.finalScore)}</span></div>
          <div class="k"><b>${esc(Math.round(Number(e.goalsScore || 0) * 10) / 10)}</b><span>${esc(t.performance.goalsScore)} (${esc(wG)}%)</span></div>
          <div class="k"><b>${esc(Math.round(Number(e.personalScore || 0) * 10) / 10)}</b><span>${esc(t.performance.personalScore)} (${esc(wP)}%)</span></div>
        </div>`
      : `<div class="muted small">${esc(t.performance.finalScore)}: —</div>`;

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
    .small { font-size: 11px; }
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
    .kpi { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .k { padding: 10px; border-radius: 14px; border-left: 3px solid ${esc(secondaryColor)}; background: rgba(0,0,0,0.22); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .k b { display:block; font-size: 16px; }
    .k span { color: ${esc(font2 || "#a0a7a8")}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; vertical-align: top; }
    th { text-align: left; color: ${esc(font2 || "#a0a7a8")}; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
    .tt { font-weight: 800; }
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
              <div class="sub muted">${esc(t.performance.detailTitle)}</div>
            </div>
          </div>
          <div class="sub muted" style="margin-top:10px;">
            <b>${esc(t.performance.employee)}:</b> ${esc(e.employee.name)} · ${esc(e.employee.email)}${e.employee.team?.name ? ` · ${esc(e.employee.team.name)}` : ""}${e.employee.position ? ` · ${esc(e.employee.position)}` : ""}
          </div>
          <div class="sub muted">
            <b>${esc(t.performance.manager)}:</b> ${esc(e.manager.name)} · ${esc(e.manager.email)}
          </div>
          <div class="sub muted">
            <b>${esc(t.performance.status)}:</b> <span class="badge">${esc(e.status)}</span> · ${esc(e.locked ? t.performance.locked : t.performance.unlocked)}
          </div>
          <div class="sub muted">
            <b>Period:</b> ${esc(startIso)} → ${esc(endIso)} · <b>Label:</b> ${esc(e.periodLabel)}
          </div>
        </div>
        <div class="sub muted">${esc(generatedAt)}<div class="muted small">${esc(APP_TIMEZONE)}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="section">${esc(t.performance.metaTitle)}</div>
      ${scoresHtml}
      ${e.managerFinalComment ? `<div class="muted small" style="margin-top:10px;"><b>${esc(t.performance.finalComment)}:</b> ${esc(e.managerFinalComment)}</div>` : ""}
    </div>

    <div class="card">
      <div class="section">${esc(t.performance.goalsTitle)}</div>
      <table>
        <thead>
          <tr>
            <th>${esc(t.performance.goalTitle)}</th>
            <th style="text-align:right">${esc(t.performance.goalWeight)}</th>
            <th style="text-align:right">${esc(t.performance.selfPercent)}</th>
            <th>${esc(t.performance.selfComment)}</th>
            <th style="text-align:right">${esc(t.performance.managerPercent)}</th>
            <th>${esc(t.performance.managerComment)}</th>
          </tr>
        </thead>
        <tbody>
          ${goalsRows || `<tr><td colspan="6" class="muted">${esc(t.performance.emptyGoals)}</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="section">${esc(t.performance.personalTitle)}</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${esc(t.performance.personalTitle)}</th>
            <th style="text-align:right">${esc(t.performance.rating)}</th>
            <th>${esc(t.performance.managerComment)}</th>
          </tr>
        </thead>
        <tbody>
          ${personalRows || `<tr><td colspan="4" class="muted">${esc(t.performance.emptyPersonal)}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  const filenameSafe = safeFilename(`Performance_${e.employee.name}_${e.periodLabel}.pdf`) || "Performance.pdf";

  try {
    return await renderPdfResponse({ html, filename: filenameSafe });
  } catch (error) {
    return new Response(`PDF export failed: ${String((error as any)?.message || error)}`, { status: 500 });
  }
}
