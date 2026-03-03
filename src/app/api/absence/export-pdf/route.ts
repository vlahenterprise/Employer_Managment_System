import { prisma } from "@/server/db";
import { authOptions } from "@/server/auth";
import { getServerSession } from "next-auth/next";
import { APP_TIMEZONE, getAppSettings } from "@/server/app-settings";
import { getBrandingSettings, getThemeCssVars } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getAllowedEmployeesForManager, loadOrgUsers } from "@/server/org";

export const runtime = "nodejs";

function esc(s: unknown) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function utcDateFromIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function businessDaysByYear(fromIso: string, toIso: string, year: number) {
  const from = utcDateFromIso(fromIso);
  const to = utcDateFromIso(toIso);
  if (!from || !to) return 0;
  if (from.getTime() > to.getTime()) return 0;
  let count = 0;
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    if (cur.getUTCFullYear() === year) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) count += 1;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function toIsoInTz(d: Date) {
  return formatInTimeZone(d, APP_TIMEZONE, "yyyy-MM-dd");
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true, teamId: true }
  });
  if (!actor || actor.status !== "ACTIVE") return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const scopeRaw = (url.searchParams.get("scope") || "self").trim().toLowerCase();
  const employeeIdRaw = String(url.searchParams.get("employeeId") || "").trim();

  const orgUsers = await loadOrgUsers();
  const allowedIds = getAllowedEmployeesForManager(actor.id, orgUsers);

  let employeeIds: string[] = [];
  if (scopeRaw === "self") {
    employeeIds = [actor.id];
  } else if (scopeRaw === "employee") {
    if (!employeeIdRaw) return new Response("Missing employeeId", { status: 400 });
    if (!allowedIds.has(employeeIdRaw)) return new Response("Forbidden", { status: 403 });
    employeeIds = [employeeIdRaw];
  } else if (scopeRaw === "team") {
    const direct = orgUsers.filter((u) => u.managerId === actor.id).map((u) => u.id);
    let list = [...direct];
    if (list.length === 0 && actor.role === "ADMIN" && actor.teamId) {
      list = orgUsers.filter((u) => u.teamId === actor.teamId).map((u) => u.id);
    }
    if (!list.includes(actor.id)) list.push(actor.id);
    employeeIds = Array.from(new Set(list)).filter((id) => allowedIds.has(id));
  } else {
    return new Response("Bad scope", { status: 400 });
  }

  const year = new Date().getFullYear();
  const yearStart = fromZonedTime(`${year}-01-01T00:00:00`, APP_TIMEZONE);
  const yearEnd = fromZonedTime(`${year}-12-31T23:59:59.999`, APP_TIMEZONE);

  const [app, branding, theme, users, absences] = await Promise.all([
    getAppSettings(),
    getBrandingSettings(),
    getThemeCssVars(),
    prisma.user.findMany({
      where: { id: { in: employeeIds } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        team: { select: { name: true } },
        position: true,
        annualLeaveDays: true,
        homeOfficeDays: true,
        slavaDays: true,
        carryOverAnnualLeave: true
      }
    }),
    prisma.absence.findMany({
      where: {
        employeeId: { in: employeeIds },
        dateFrom: { lte: yearEnd },
        dateTo: { gte: yearStart }
      },
      orderBy: [{ employeeId: "asc" }, { dateFrom: "desc" }],
      select: {
        id: true,
        employeeId: true,
        type: true,
        status: true,
        dateFrom: true,
        dateTo: true,
        days: true,
        approvedAt: true,
        approver: { select: { email: true } },
        comment: true
      }
    })
  ]);

  const usage: Record<string, { annual: number; home: number; slava: number }> = {};
  const history: Record<string, typeof absences> = {};
  for (const id of employeeIds) {
    usage[id] = { annual: 0, home: 0, slava: 0 };
    history[id] = [];
  }

  for (const a of absences) {
    history[a.employeeId]?.push(a);
    if (a.status !== "APPROVED") continue;
    const fromIso = toIsoInTz(a.dateFrom);
    const toIso = toIsoInTz(a.dateTo);
    const type = String(a.type || "").toUpperCase();
    const yDays = type === "SLAVA" ? (Number.parseInt(fromIso.slice(0, 4), 10) === year ? 1 : 0) : businessDaysByYear(fromIso, toIso, year);
    if (type === "ANNUAL_LEAVE") usage[a.employeeId].annual += yDays;
    if (type === "HOME_OFFICE") usage[a.employeeId].home += yDays;
    if (type === "SLAVA") usage[a.employeeId].slava += yDays;
  }

  const cutoff = new Date(Date.UTC(year, 5, 30, 23, 59, 59));
  const now = new Date();

  const lang = getRequestLang();
  const t = getI18n(lang);

  const sec = (theme as any)["--color-secondary"] as string | undefined;
  const secondaryColor = sec && /^#[0-9a-fA-F]{3,6}$/.test(sec) ? sec : "#F05123";
  const ok = (theme as any)["--color-ok"] as string | undefined;
  const okColor = ok && /^#[0-9a-fA-F]{3,6}$/.test(ok) ? ok : "#1E8E6A";
  const font = (theme as any)["--color-font-main"] as string | undefined;
  const font2 = (theme as any)["--color-font-secondary"] as string | undefined;
  const dark1 = (theme as any)["--color-dark-1"] as string | undefined;
  const dark2 = (theme as any)["--color-dark-2"] as string | undefined;
  const bgGlow = rgbaFromHex(secondaryColor, 0.18, "rgba(240, 81, 35, 0.18)");
  const bgOk = rgbaFromHex(okColor, 0.14, "rgba(30, 142, 106, 0.14)");

  const employeesHtml = users
    .map((u) => {
      const used = usage[u.id] ?? { annual: 0, home: 0, slava: 0 };
      const annualLimit = Math.max(0, Number(u.annualLeaveDays ?? app.AnnualLeaveDays ?? 0));
      const homeLimit = Math.max(0, Number(u.homeOfficeDays ?? app.HomeOfficeLimit ?? 0));
      const slavaLimit = Math.max(0, Number(u.slavaDays ?? 1));
      const carryoverRaw = Math.max(0, Number(u.carryOverAnnualLeave ?? 0));
      const carryover = now.getTime() <= cutoff.getTime() ? carryoverRaw : 0;
      const annualRemaining = Math.max(0, annualLimit + carryover - used.annual);
      const homeRemaining = Math.max(0, homeLimit - used.home);
      const slavaRemaining = Math.max(0, slavaLimit - used.slava);

      const rows = (history[u.id] ?? [])
        .map((a) => {
          const fromIso = toIsoInTz(a.dateFrom);
          const toIso = toIsoInTz(a.dateTo);
          const approvedAt = a.approvedAt ? formatInTimeZone(a.approvedAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm") : "";
          return `<tr>
            <td>${esc(String(a.type || ""))}</td>
            <td>${esc(fromIso)} → ${esc(toIso)}</td>
            <td style="text-align:right">${esc(Number(a.days || 0))}</td>
            <td>${esc(String(a.status || ""))}</td>
            <td>${esc(approvedAt)}</td>
            <td>${esc(a.approver?.email || "")}</td>
            <td>${esc(String(a.comment || ""))}</td>
          </tr>`;
        })
        .join("");

      return `
        <div class="card">
          <div class="empTop">
            <div>
              <div class="empName">${esc(u.name)}</div>
              <div class="muted small">${esc(u.email)}${u.team?.name ? ` · ${esc(u.team.name)}` : ""}${u.position ? ` · ${esc(u.position)}` : ""}</div>
            </div>
            <div class="muted small">${esc(year)}</div>
          </div>
          <div class="kpi">
            <div class="k"><b>${esc(annualRemaining)}</b><span>${esc(t.absence.remainingAnnual)} (${esc(used.annual)}/${esc(annualLimit)})</span></div>
            <div class="k"><b>${esc(homeRemaining)}</b><span>${esc(t.absence.remainingHomeOffice)} (${esc(used.home)}/${esc(homeLimit)})</span></div>
            <div class="k"><b>${esc(slavaRemaining)}</b><span>${esc(t.absence.remainingSlava)} (${esc(used.slava)}/${esc(slavaLimit)})</span></div>
            <div class="k"><b>${esc(carryover)}</b><span>${esc(t.absence.carryover)} · ${esc(t.absence.carryoverUntil)} ${esc(formatInTimeZone(cutoff, "UTC", "yyyy-MM-dd"))}</span></div>
          </div>
          <div class="section">${esc(t.absence.myRequestsTitle)}</div>
          <table>
            <thead>
              <tr>
                <th>${esc(t.absence.type)}</th>
                <th>${esc(t.absence.from)} → ${esc(t.absence.to)}</th>
                <th style="text-align:right">${esc(t.absence.days)}</th>
                <th>${esc(t.absence.status)}</th>
                <th>${esc(t.absence.approvedAt)}</th>
                <th>${esc(t.absence.approver)}</th>
                <th>${esc(t.absence.comment)}</th>
              </tr>
            </thead>
            <tbody>${rows || ""}</tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const logoUrl = branding.logoUrl ? esc(branding.logoUrl) : "";
  const scopeLabel = scopeRaw.toUpperCase();

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
    .section { font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; font-size: 12px; margin: 14px 0 10px; }
    .kpi { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
    .k { padding: 10px; border-radius: 14px; border-left: 3px solid ${esc(secondaryColor)}; background: rgba(0,0,0,0.22); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .k b { display:block; font-size: 16px; }
    .k span { color: ${esc(font2 || "#a0a7a8")}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .empTop { display:flex; justify-content:space-between; gap: 12px; align-items:flex-start; }
    .empName { font-weight: 900; font-size: 15px; }
    .small { font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 11px; vertical-align: top; }
    th { text-align: left; color: ${esc(font2 || "#a0a7a8")}; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
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
              <div class="sub muted">${esc(t.absence.title)}</div>
            </div>
          </div>
          <div class="sub muted" style="margin-top:10px;">
            <b>${esc(t.absence.status)}:</b> <span class="badge">${esc(scopeLabel)}</span>
          </div>
          <div class="sub muted">${esc(t.absence.tzNote(APP_TIMEZONE))}</div>
        </div>
        <div class="sub muted">${esc(new Date().toLocaleString(lang === "sr" ? "sr-RS" : "en-GB"))}</div>
      </div>
    </div>

    ${employeesHtml || ""}
  </div>
</body>
</html>`;

  const filenameSafe = `Absence_${scopeLabel}_${year}.pdf`.replaceAll(" ", "_");

  try {
    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
      });

      const ab = new ArrayBuffer(pdf.byteLength);
      new Uint8Array(ab).set(pdf);
      const blob = new Blob([ab], { type: "application/pdf" });
      return new Response(blob, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filenameSafe}"`,
          "Cache-Control": "no-store"
        }
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    return new Response(`PDF export failed: ${String((error as any)?.message || error)}`, { status: 500 });
  }
}
