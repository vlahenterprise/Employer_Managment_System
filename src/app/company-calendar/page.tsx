import Link from "next/link";
import { endOfMonth, startOfMonth } from "date-fns";
import { GuidancePanel } from "@/components/GuidancePanel";
import { LabelWithTooltip } from "@/components/Tooltip";
import { IconArrowLeft, IconCalendar } from "@/components/icons";
import CompanyCalendarView from "./CompanyCalendarView";
import CompanyEventForm from "./CompanyEventForm";
import { createCompanyEventAction, deleteCompanyEventAction, updateCompanyEventAction } from "./actions";
import { getRequestLang } from "@/i18n/server";
import { APP_TIMEZONE } from "@/server/app-settings";
import { canManageCompanyCalendar, getCompanyCalendar, getCompanyCalendarPickerData } from "@/server/company-calendar";
import { requireActiveUser } from "@/server/current-user";
import { formatInTimeZone } from "@/server/time";

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

function defaultMonthRange() {
  const now = new Date();
  return {
    fromIso: formatInTimeZone(startOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd"),
    toIso: formatInTimeZone(endOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd"),
  };
}

function decodeMessage(value?: string) {
  return value ? decodeURIComponent(value) : null;
}

function copyFor(lang: "sr" | "en") {
  return lang === "sr"
    ? {
        title: "Kompanijski kalendar",
        subtitle: "Zajednički pregled kompanijskih događaja, uključenih ljudi i pozicija.",
        back: "Nazad na početnu",
        calendar: "Kalendar",
        guideTitle: "Kako da koristiš kompanijski kalendar",
        guideDescription:
          "Svi zaposleni vide događaje. Samo osobe sa Company calendar add-on pristupom mogu da kreiraju, menjaju i uklanjaju događaje.",
        guideItems: [
          "Klikni dan u kalendaru da vidiš događaje za taj datum.",
          "Događaj može biti vezan za konkretne zaposlene, pozicije ili za celu kompaniju.",
          "Ako nema izabranih ljudi ili pozicija, događaj se tretira kao kompanijski opšti događaj.",
        ],
        newEvent: "Novi kompanijski događaj",
        manageEvents: "Uredi događaje",
        readOnly:
          "Imaš pristup za pregled. Za dodavanje i izmenu događaja potreban je Company calendar add-on pristup.",
        create: "Dodaj događaj",
        save: "Sačuvaj",
        delete: "Ukloni",
        noEvents: "Nema događaja u ovom opsegu.",
        globalEvent: "Svi zaposleni",
        createdBy: "Kreirao/la",
      }
    : {
        title: "Company Calendar",
        subtitle: "Shared view of company events, involved people, and positions.",
        back: "Back to dashboard",
        calendar: "Calendar",
        guideTitle: "How to use company calendar",
        guideDescription:
          "All employees can view events. Only people with Company calendar add-on access can create, edit, and remove events.",
        guideItems: [
          "Click a day in the calendar to see events for that date.",
          "An event can be connected to specific employees, positions, or the entire company.",
          "If no people or positions are selected, the event is treated as a company-wide event.",
        ],
        newEvent: "New company event",
        manageEvents: "Edit events",
        readOnly: "You have read access. Creating and editing events requires Company calendar add-on access.",
        create: "Add event",
        save: "Save",
        delete: "Remove",
        noEvents: "No events in this range.",
        globalEvent: "All employees",
        createdBy: "Created by",
      };
}

export default async function CompanyCalendarPage({
  searchParams,
}: {
  searchParams: { fromIso?: string; toIso?: string; success?: string; error?: string; myEvents?: string };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const copy = copyFor(lang);
  const rangeDefault = defaultMonthRange();
  const fromIso = String(searchParams.fromIso || rangeDefault.fromIso).trim();
  const toIso = String(searchParams.toIso || rangeDefault.toIso).trim();
  const canManage = canManageCompanyCalendar(user);
  const myEventsFilter = searchParams.myEvents === "1";

  const [calendar, pickerData] = await Promise.all([
    getCompanyCalendar({ range: { fromIso, toIso } }),
    canManage
      ? getCompanyCalendarPickerData()
      : Promise.resolve({ users: [], positions: [], teams: [] }),
  ]);

  const events = calendar.ok ? calendar.items : [];
  const filteredEvents = myEventsFilter
    ? events.filter(
        (e) => e.participants.some((p) => p.id === user.id) || e.participants.length === 0
      )
    : events;

  const success = decodeMessage(searchParams.success);
  const error = decodeMessage(searchParams.error || (!calendar.ok ? calendar.error : undefined));

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{copy.title}</h1>
                <p className="muted">{copy.subtitle}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {copy.back}
                </Link>
                <a className="button button-secondary" href="#calendar">
                  <IconCalendar size={18} /> {copy.calendar}
                </a>
              </div>
            </div>
          </div>
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <GuidancePanel
          title={copy.guideTitle}
          description={copy.guideDescription}
          items={copy.guideItems}
        />

        <section id="calendar" className="panel stack">
          <div className="header">
            <h2 className="h2">
              <LabelWithTooltip
                label={copy.calendar}
                tooltip={
                  lang === "sr"
                    ? "Ovaj kalendar vide svi zaposleni. Događaje uređuju samo korisnici sa Company calendar add-on pristupom."
                    : "All employees can view this calendar. Events are managed only by users with Company calendar add-on access."
                }
              />
            </h2>
            <div className="inline" style={{ gap: 8 }}>
              <a
                href={`/company-calendar?fromIso=${fromIso}&toIso=${toIso}${myEventsFilter ? "" : "&myEvents=1"}`}
                className={`button ${myEventsFilter ? "button-primary" : "button-secondary"}`}
              >
                {lang === "sr"
                  ? myEventsFilter
                    ? "Moji događaji ✓"
                    : "Moji događaji"
                  : myEventsFilter
                  ? "My events ✓"
                  : "My events"}
              </a>
              {myEventsFilter ? (
                <a
                  href={`/company-calendar?fromIso=${fromIso}&toIso=${toIso}`}
                  className="button button-secondary"
                >
                  {lang === "sr" ? "Svi događaji" : "All events"}
                </a>
              ) : null}
            </div>
          </div>
          <CompanyCalendarView
            lang={lang}
            timeZone={APP_TIMEZONE}
            fromIso={fromIso}
            toIso={toIso}
            items={filteredEvents}
            canManage={canManage}
            deleteAction={canManage ? deleteCompanyEventAction : undefined}
          />
        </section>

        {canManage ? (
          <section className="panel stack">
            <h2 className="h2">{copy.newEvent}</h2>
            <CompanyEventForm
              pickerData={pickerData}
              action={createCompanyEventAction}
              submitLabel={copy.create}
              lang={lang}
              defaultFromIso={fromIso}
            />
          </section>
        ) : (
          <section className="panel stack">
            <div className="notice notice-muted">
              <div className="muted small">{copy.readOnly}</div>
            </div>
          </section>
        )}

        {canManage ? (
          <section className="panel stack">
            <h2 className="h2">{copy.manageEvents}</h2>
            {/* Auto-open <details> when navigating from calendar edit link */}
            <script dangerouslySetInnerHTML={{ __html: `(function(){function openHash(){var h=location.hash;if(!h)return;var el=document.querySelector(h);if(el&&el.tagName==='DETAILS'){el.open=true;setTimeout(function(){el.scrollIntoView({behavior:'smooth',block:'start'});},80);}}openHash();window.addEventListener('hashchange',openHash);})();` }} />
            {events.length === 0 ? <div className="muted">{copy.noEvents}</div> : null}
            <div className="list">
              {events.map((event) => (
                <details key={event.eventId} id={`event-${event.eventId}`} className="item stack">
                  <summary className="item-top" style={{ cursor: "pointer" }}>
                    <div>
                      <div className="item-title">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: colorHex(event.color),
                            display: "inline-block",
                            marginRight: 6,
                          }}
                        />
                        {event.title}
                      </div>
                      <div className="muted small">
                        {event.startLabel} → {event.endLabel}
                        {event.location ? ` · ${event.location}` : ""}
                      </div>
                      <div className="muted small">
                        {event.participants.length || event.positions.length
                          ? `${event.participants.length} ljudi · ${event.positions.length} pozicija`
                          : copy.globalEvent}
                        {event.createdBy ? ` · ${copy.createdBy}: ${event.createdBy.name}` : ""}
                      </div>
                    </div>
                    <div className="pills">
                      <span className="pill absence-legend annual">{copy.calendar}</span>
                    </div>
                  </summary>
                  <CompanyEventForm
                    pickerData={pickerData}
                    event={event}
                    action={updateCompanyEventAction}
                    submitLabel={copy.save}
                    lang={lang}
                    defaultFromIso={event.fromIso}
                  />
                  <form action={deleteCompanyEventAction}>
                    <input type="hidden" name="eventId" value={event.eventId} />
                    <button className="button button-danger" type="submit">
                      {copy.delete}
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
