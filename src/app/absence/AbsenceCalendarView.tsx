"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getI18n, type Lang } from "@/i18n";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";

type AbsenceType = "ANNUAL_LEAVE" | "HOME_OFFICE" | "SLAVA" | "SICK" | "OTHER";
type AbsenceStatus = "PENDING" | "APPROVED";

export type AbsenceCalendarItem = {
  absenceId: string;
  employee: { id: string; name: string; email: string; teamName: string };
  type: AbsenceType;
  status: AbsenceStatus;
  fromIso: string;
  toIso: string;
  days: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseIsoDate(iso: string) {
  const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

function isoFromUtcDate(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function monthStartFromIso(fromIso: string) {
  const d = parseIsoDate(fromIso);
  const base = d ?? new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
}

function endOfMonthUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function addMonthsUtc(d: Date, delta: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

function todayIsoInTz(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function isoFromMonthStart(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}

function isoFromMonthEnd(d: Date) {
  const end = endOfMonthUtc(d);
  return isoFromUtcDate(end);
}

function weekdayLabels(lang: Lang) {
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const monday = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01 is Monday
  return Array.from({ length: 7 }).map((_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).toUpperCase());
}

function monthLabel(lang: Lang, monthStart: Date) {
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
}

function typeClass(type: AbsenceType) {
  if (type === "ANNUAL_LEAVE") return "annual";
  if (type === "HOME_OFFICE") return "home";
  if (type === "SLAVA") return "slava";
  if (type === "SICK") return "sick";
  return "other";
}

function typeAbbr(lang: Lang, type: AbsenceType) {
  if (type === "ANNUAL_LEAVE") return lang === "sr" ? "GO" : "AL";
  if (type === "HOME_OFFICE") return "HO";
  if (type === "SLAVA") return lang === "sr" ? "SL" : "SL";
  if (type === "SICK") return lang === "sr" ? "BOL" : "SICK";
  return lang === "sr" ? "OST" : "OTH";
}

function typeLabel(t: ReturnType<typeof getI18n>, type: AbsenceType) {
  if (type === "ANNUAL_LEAVE") return t.absence.typeAnnual;
  if (type === "HOME_OFFICE") return t.absence.typeHome;
  if (type === "SLAVA") return t.absence.typeSlava;
  if (type === "SICK") return t.absence.typeSick;
  return t.absence.typeOther;
}

function statusLabel(t: ReturnType<typeof getI18n>, status: AbsenceStatus) {
  return status === "APPROVED" ? t.absence.statusApproved : t.absence.statusPending;
}

function shortName(full: string) {
  const s = String(full || "").trim();
  if (!s) return "—";
  const first = s.split(/\s+/)[0];
  return first || s;
}

export default function AbsenceCalendarView(props: {
  lang: Lang;
  timeZone: string;
  fromIso: string;
  toIso: string;
  items: AbsenceCalendarItem[];
}) {
  const t = getI18n(props.lang);
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthStart = useMemo(() => monthStartFromIso(props.fromIso || props.toIso), [props.fromIso, props.toIso]);
  const monthEnd = useMemo(() => endOfMonthUtc(monthStart), [monthStart]);
  const monthStartIso = useMemo(() => isoFromMonthStart(monthStart), [monthStart]);
  const monthEndIso = useMemo(() => isoFromMonthEnd(monthStart), [monthStart]);
  const todayIso = useMemo(() => todayIsoInTz(props.timeZone), [props.timeZone]);

  const [selectedIso, setSelectedIso] = useState(() => {
    if (todayIso >= monthStartIso && todayIso <= monthEndIso) return todayIso;
    return monthStartIso;
  });

  const cells = useMemo(() => {
    // Monday-based week start.
    const firstDowMon = (monthStart.getUTCDay() + 6) % 7; // 0..6
    const start = new Date(monthStart.getTime());
    start.setUTCDate(1 - firstDowMon);

    const out: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start.getTime());
      d.setUTCDate(start.getUTCDate() + i);
      out.push({
        iso: isoFromUtcDate(d),
        day: d.getUTCDate(),
        inMonth: d.getUTCMonth() === monthStart.getUTCMonth()
      });
    }
    return out;
  }, [monthStart]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AbsenceCalendarItem[]>();
    for (const c of cells) {
      const list = (props.items || [])
        .filter((x) => x.fromIso <= c.iso && x.toIso >= c.iso)
        .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
      map.set(c.iso, list);
    }
    return map;
  }, [cells, props.items]);

  const selectedItems = useMemo(() => itemsByDay.get(selectedIso) ?? [], [itemsByDay, selectedIso]);

  function goMonth(delta: number) {
    const nextStart = addMonthsUtc(monthStart, delta);
    const fromIso = isoFromMonthStart(nextStart);
    const toIso = isoFromMonthEnd(nextStart);

    const q = new URLSearchParams(searchParams.toString());
    q.set("fromIso", fromIso);
    q.set("toIso", toIso);
    router.push(`/absence?${q.toString()}`);
  }

  const weekLabels = useMemo(() => weekdayLabels(props.lang), [props.lang]);

  return (
    <div className="absence-cal stack">
      <div className="cal-header">
        <div>
          <div className="cal-title">{monthLabel(props.lang, monthStart)}</div>
          <div className="muted small">
            {t.absence.calendarRangeLabel}: {props.fromIso} → {props.toIso} · {props.timeZone}
          </div>
        </div>
        <div className="inline cal-nav">
          <button className="button button-secondary" type="button" onClick={() => goMonth(-1)}>
            <IconArrowLeft size={18} /> {t.absence.prevMonth}
          </button>
          <button className="button button-secondary" type="button" onClick={() => goMonth(1)}>
            {t.absence.nextMonth} <IconArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="cal-legend-grid">
        <div className="legend-group">
          <div className="legend-group-title">{t.absence.legendStatusTitle}</div>
          <div className="inline cal-legend">
            <span className="pill pill-status pill-status-approved">{t.absence.legendApprovedStyle}</span>
            <span className="pill pill-status pill-status-pending">{t.absence.legendPendingStyle}</span>
          </div>
        </div>
        <div className="legend-group">
          <div className="legend-group-title">{t.absence.legendTypeTitle}</div>
          <div className="inline cal-legend">
            <span className="pill absence-legend annual">{t.absence.typeAnnual}</span>
            <span className="pill absence-legend home">{t.absence.typeHome}</span>
            <span className="pill absence-legend slava">{t.absence.typeSlava}</span>
            <span className="pill absence-legend sick">{t.absence.typeSick}</span>
            <span className="pill absence-legend other">{t.absence.typeOther}</span>
          </div>
        </div>
      </div>

      <div className="cal-grid">
        {weekLabels.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}

        {cells.map((c) => {
          const list = itemsByDay.get(c.iso) ?? [];
          const isSelected = c.iso === selectedIso;
          const isToday = c.iso === todayIso;
          const show = list.slice(0, 4);
          const rest = Math.max(0, list.length - show.length);
          return (
            <button
              key={c.iso}
              type="button"
              className={`cal-day ${c.inMonth ? "" : "out"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
              onClick={() => setSelectedIso(c.iso)}
            >
              <div className="cal-dayhead">
                <span className="cal-daynum">{c.day}</span>
                {list.length > 0 ? <span className="cal-count">{list.length}</span> : null}
              </div>

              <div className="cal-chips">
                {show.map((x) => (
                  <div
                    key={`${c.iso}:${x.absenceId}`}
                    className={`absence-chip ${typeClass(x.type)} ${x.status === "PENDING" ? "pending" : "approved"}`}
                    title={`${x.employee.name} (${x.employee.email})\n${typeLabel(t, x.type)} · ${x.fromIso} → ${x.toIso}\n${statusLabel(t, x.status)}`}
                  >
                    <span className={`absence-chip-dot ${x.status === "PENDING" ? "pending" : "approved"}`} />
                    <span className="absence-chip-name">{shortName(x.employee.name)}</span>
                    <span className="absence-chip-tag">{typeAbbr(props.lang, x.type)}</span>
                  </div>
                ))}
                {rest > 0 ? <div className="absence-more">+{rest}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="panel stack cal-details">
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">{t.absence.selectedDay}</div>
            <div className="muted small">{selectedIso}</div>
          </div>
          <div className="pill">{selectedItems.length}</div>
        </div>

        {selectedItems.length === 0 ? (
          <div className="muted">{t.absence.noAbsencesOnDay}</div>
        ) : (
          <div className="list">
            {selectedItems.map((x) => (
              <div key={`${selectedIso}:${x.absenceId}`} className="item item-compact">
                <div>
                  <div className="item-title">
                    {x.employee.name} · {typeLabel(t, x.type)} · {x.fromIso} → {x.toIso}
                  </div>
                  <div className="muted small">
                    {x.employee.email} · {x.employee.teamName || "—"} · {t.absence.days}: {x.days}
                  </div>
                </div>
                <div className="pills">
                  <span className={`pill pill-status ${x.status === "APPROVED" ? "pill-status-approved" : "pill-status-pending"}`}>
                    {statusLabel(t, x.status)}
                  </span>
                  <span className={`pill absence-legend ${typeClass(x.type)}`}>{typeAbbr(props.lang, x.type)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
