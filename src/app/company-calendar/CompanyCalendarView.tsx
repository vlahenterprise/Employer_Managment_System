"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import type { CompanyCalendarItem } from "@/server/company-calendar";
import type { Lang } from "@/i18n";

const EVENT_COLOR_HEX: Record<string, string> = {
  orange: "#f05123",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#a855f7",
  yellow: "#eab308",
  teal: "#14b8a6",
  pink: "#ec4899",
  indigo: "#6366f1",
};
function colorHex(color: string) {
  return EVENT_COLOR_HEX[color] ?? "#f05123";
}

const EVENT_COLOR_LABELS: Record<string, { sr: string; en: string }> = {
  orange: { sr: "Konferencija", en: "Conference" },
  blue: { sr: "Vebinar / Online konf.", en: "Webinar / Online conf." },
  purple: { sr: "Radionica", en: "Workshop" },
  red: { sr: "Q&A Sesija", en: "Q&A Session" },
  green: { sr: "Timske aktivnosti", en: "Team activities" },
  teal: { sr: "Team Building", en: "Team Building" },
  pink: { sr: "Onboarding", en: "Onboarding" },
  yellow: { sr: "Kompanijski odmor", en: "Company holiday" },
  indigo: { sr: "Državni praznik", en: "National holiday" },
};

function eventTypeName(color: string, lang: "sr" | "en"): string {
  return EVENT_COLOR_LABELS[color]?.[lang] ?? (lang === "sr" ? "Ostalo" : "Other");
}

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
  return Array.from({ length: 7 }).map((_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))).toUpperCase());
}

function monthLabel(lang: Lang, monthStart: Date) {
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
}

function participantLabel(event: CompanyCalendarItem, lang: Lang) {
  if (event.participants.length === 0 && event.positions.length === 0) return lang === "sr" ? "Svi zaposleni" : "All employees";
  const userCount = event.participants.length;
  const positionCount = event.positions.length;
  const users = lang === "sr" ? "ljudi" : "people";
  const positions = lang === "sr" ? "pozicija" : "positions";
  return [userCount ? `${userCount} ${users}` : "", positionCount ? `${positionCount} ${positions}` : ""].filter(Boolean).join(" · ");
}

function firstLine(event: CompanyCalendarItem) {
  const firstParticipant = event.participants[0]?.name;
  const firstPosition = event.positions[0]?.title;
  return firstParticipant || firstPosition || "Company";
}

export default function CompanyCalendarView(props: {
  lang: Lang;
  timeZone: string;
  fromIso: string;
  toIso: string;
  items: CompanyCalendarItem[];
  canManage?: boolean;
  deleteAction?: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthStart = useMemo(() => monthStartFromIso(props.fromIso || props.toIso), [props.fromIso, props.toIso]);
  const monthStartIso = useMemo(() => isoFromMonthStart(monthStart), [monthStart]);
  const monthEndIso = useMemo(() => isoFromMonthEnd(monthStart), [monthStart]);
  const todayIso = useMemo(() => todayIsoInTz(props.timeZone), [props.timeZone]);
  const [selectedIso, setSelectedIso] = useState(() => (todayIso >= monthStartIso && todayIso <= monthEndIso ? todayIso : monthStartIso));

  const cells = useMemo(() => {
    const firstDowMon = (monthStart.getUTCDay() + 6) % 7;
    const start = new Date(monthStart.getTime());
    start.setUTCDate(1 - firstDowMon);

    const out: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start.getTime());
      d.setUTCDate(start.getUTCDate() + i);
      out.push({ iso: isoFromUtcDate(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === monthStart.getUTCMonth() });
    }
    return out;
  }, [monthStart]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CompanyCalendarItem[]>();
    for (const c of cells) {
      const list = (props.items || [])
        .filter((item) => item.fromIso <= c.iso && item.toIso >= c.iso)
        .sort((a, b) => a.title.localeCompare(b.title));
      map.set(c.iso, list);
    }
    return map;
  }, [cells, props.items]);

  const selectedItems = useMemo(() => itemsByDay.get(selectedIso) ?? [], [itemsByDay, selectedIso]);
  const weekLabels = useMemo(() => weekdayLabels(props.lang), [props.lang]);
  const copy = props.lang === "sr"
    ? {
        range: "Opseg",
        prev: "Prethodni mesec",
        next: "Sledeći mesec",
        selected: "Izabrani dan",
        none: "Nema kompanijskih događaja za ovaj dan.",
        participants: "Uključeni",
        allDay: "Ceo dan",
        time: "Vreme"
      }
    : {
        range: "Range",
        prev: "Previous month",
        next: "Next month",
        selected: "Selected day",
        none: "No company events for this day.",
        participants: "Included",
        allDay: "All day",
        time: "Time"
      };

  function goMonth(delta: number) {
    const nextStart = addMonthsUtc(monthStart, delta);
    const q = new URLSearchParams(searchParams.toString());
    q.set("fromIso", isoFromMonthStart(nextStart));
    q.set("toIso", isoFromMonthEnd(nextStart));
    router.push(`/company-calendar?${q.toString()}`);
  }

  return (
    <div className="absence-cal stack">
      <div className="cal-header">
        <div>
          <div className="cal-title">{monthLabel(props.lang, monthStart)}</div>
          <div className="muted small">
            {copy.range}: {props.fromIso} → {props.toIso} · {props.timeZone}
          </div>
        </div>
        <div className="inline cal-nav">
          <button className="button button-secondary" type="button" onClick={() => goMonth(-1)}>
            <IconArrowLeft size={18} /> {copy.prev}
          </button>
          <button className="button button-secondary" type="button" onClick={() => goMonth(1)}>
            {copy.next} <IconArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="cal-legend-grid">
        <div className="legend-group" style={{ gridColumn: "1 / -1" }}>
          <div className="legend-group-title">{props.lang === "sr" ? "Tipovi događaja" : "Event types"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {([
              { color: "orange", sr: "Konferencija", en: "Conference" },
              { color: "blue", sr: "Vebinar / Online konf.", en: "Webinar / Online" },
              { color: "purple", sr: "Radionice", en: "Workshops" },
              { color: "red", sr: "Q&A Sesija", en: "Q&A Session" },
              { color: "green", sr: "Timske aktivnosti", en: "Team activities" },
              { color: "teal", sr: "Team Building", en: "Team Building" },
              { color: "pink", sr: "Onboarding", en: "Onboarding" },
              { color: "yellow", sr: "Komp. odmor", en: "Company holiday" },
              { color: "indigo", sr: "Državni praznik", en: "National holiday" },
            ] as const).map((t) => (
              <span
                key={t.color}
                className="pill"
                style={{
                  background: `${colorHex(t.color)}1a`,
                  borderColor: `${colorHex(t.color)}44`,
                  color: colorHex(t.color),
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: colorHex(t.color),
                    display: "inline-block",
                    marginRight: 5,
                    flexShrink: 0,
                  }}
                />
                {props.lang === "sr" ? t.sr : t.en}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="cal-grid">
        {weekLabels.map((weekday) => (
          <div key={weekday} className="cal-weekday">{weekday}</div>
        ))}

        {cells.map((cell) => {
          const list = itemsByDay.get(cell.iso) ?? [];
          const isSelected = cell.iso === selectedIso;
          const isToday = cell.iso === todayIso;
          const show = list.slice(0, 4);
          const rest = Math.max(0, list.length - show.length);
          return (
            <button
              key={cell.iso}
              type="button"
              className={`cal-day ${cell.inMonth ? "" : "out"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
              onClick={() => setSelectedIso(cell.iso)}
            >
              <div className="cal-dayhead">
                <span className="cal-daynum">{cell.day}</span>
                {list.length > 0 ? <span className="cal-count">{list.length}</span> : null}
              </div>
              <div className="cal-chips">
                {show.map((event) => (
                  <div
                    key={`${cell.iso}:${event.eventId}`}
                    className="absence-chip"
                    style={{
                      background: `${colorHex(event.color)}1f`,
                      borderColor: `${colorHex(event.color)}50`,
                      color: "inherit",
                    }}
                    title={`${event.title}\n${event.startLabel} → ${event.endLabel}\n${participantLabel(event, props.lang)}`}
                  >
                    <span
                      className="absence-chip-dot"
                      style={{ background: colorHex(event.color), boxShadow: `0 0 0 4px ${colorHex(event.color)}28` }}
                    />
                    <span className="absence-chip-name">{event.title}</span>
                    <span className="absence-chip-tag">{firstLine(event)}</span>
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
            <div className="h2">{copy.selected}</div>
            <div className="muted small">{selectedIso}</div>
          </div>
          <div className="pill">{selectedItems.length}</div>
        </div>

        {selectedItems.length === 0 ? (
          <div className="muted">{copy.none}</div>
        ) : (
          <div className="list">
            {selectedItems.map((event) => (
              <div key={`${selectedIso}:${event.eventId}`} className="item item-compact">
                <div>
                  <div className="item-title">
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: colorHex(event.color), display: "inline-block", marginRight: 6, flexShrink: 0 }} />
                    {event.title}
                  </div>
                  <div className="muted small">
                    {event.allDay ? copy.allDay : copy.time}: {event.startLabel} → {event.endLabel}
                    {event.location ? ` · ${event.location}` : ""}
                  </div>
                  <div className="muted small">
                    {copy.participants}: {participantLabel(event, props.lang)}
                  </div>
                  {event.description ? <div className="muted small">{event.description}</div> : null}
                  <div className="inline" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                    <span
                      className="pill"
                      style={{
                        background: `${colorHex(event.color)}22`,
                        borderColor: `${colorHex(event.color)}55`,
                        color: colorHex(event.color),
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {eventTypeName(event.color, props.lang)}
                    </span>
                    {props.canManage ? (
                      <>
                        <a
                          href={`#event-${event.eventId}`}
                          className="button button-secondary"
                          style={{ fontSize: 12, padding: "3px 12px", height: "auto", lineHeight: "1.5" }}
                        >
                          {props.lang === "sr" ? "Uredi" : "Edit"}
                        </a>
                        {props.deleteAction ? (
                          <form action={props.deleteAction} style={{ display: "inline" }}>
                            <input type="hidden" name="eventId" value={event.eventId} />
                            <button
                              className="button button-danger"
                              type="submit"
                              style={{ fontSize: 12, padding: "3px 12px", height: "auto", lineHeight: "1.5" }}
                              onClick={(e) => {
                                if (!confirm(props.lang === "sr" ? "Obrisati ovaj događaj?" : "Delete this event?")) e.preventDefault();
                              }}
                            >
                              {props.lang === "sr" ? "Obriši" : "Delete"}
                            </button>
                          </form>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="pills">
                  <span className="pill absence-legend annual">{props.lang === "sr" ? "Događaj" : "Event"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
