import Link from "next/link";
import { endOfMonth, startOfMonth } from "date-fns";
import { GuidancePanel } from "@/components/GuidancePanel";
import { LabelWithTooltip } from "@/components/Tooltip";
import { IconArrowLeft, IconCalendar } from "@/components/icons";
import UserMenu from "../dashboard/UserMenu";
import CompanyCalendarView from "./CompanyCalendarView";
import { createCompanyEventAction, deleteCompanyEventAction, updateCompanyEventAction } from "./actions";
import { getRequestLang } from "@/i18n/server";
import { APP_TIMEZONE } from "@/server/app-settings";
import { canManageCompanyCalendar, getCompanyCalendar, getCompanyCalendarPickerData, type CompanyCalendarItem, type CompanyCalendarPickerData } from "@/server/company-calendar";
import { requireActiveUser } from "@/server/current-user";
import { formatInTimeZone } from "@/server/time";

function defaultMonthRange() {
  const now = new Date();
  return {
    fromIso: formatInTimeZone(startOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd"),
    toIso: formatInTimeZone(endOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd")
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
        guideDescription: "Svi zaposleni vide događaje. Samo osobe sa Company calendar add-on pristupom mogu da kreiraju, menjaju i uklanjaju događaje.",
        guideItems: [
          "Klikni dan u kalendaru da vidiš događaje za taj datum.",
          "Događaj može biti vezan za konkretne zaposlene, pozicije ili za celu kompaniju.",
          "Ako nema izabranih ljudi ili pozicija, događaj se tretira kao kompanijski opšti događaj."
        ],
        newEvent: "Novi kompanijski događaj",
        manageEvents: "Uredi događaje",
        readOnly: "Imaš pristup za pregled. Za dodavanje i izmenu događaja potreban je Company calendar add-on pristup.",
        titleField: "Naziv događaja",
        description: "Opis",
        location: "Lokacija / link",
        from: "Od",
        to: "Do",
        startTime: "Početak",
        endTime: "Kraj",
        allDay: "Ceo dan",
        people: "Uključeni zaposleni",
        positions: "Uključene pozicije",
        create: "Dodaj događaj",
        save: "Sačuvaj",
        delete: "Ukloni",
        optional: "opciono",
        noEvents: "Nema događaja u ovom opsegu.",
        globalEvent: "Svi zaposleni",
        createdBy: "Kreirao/la"
      }
    : {
        title: "Company Calendar",
        subtitle: "Shared view of company events, involved people, and positions.",
        back: "Back to dashboard",
        calendar: "Calendar",
        guideTitle: "How to use company calendar",
        guideDescription: "All employees can view events. Only people with Company calendar add-on access can create, edit, and remove events.",
        guideItems: [
          "Click a day in the calendar to see events for that date.",
          "An event can be connected to specific employees, positions, or the entire company.",
          "If no people or positions are selected, the event is treated as a company-wide event."
        ],
        newEvent: "New company event",
        manageEvents: "Edit events",
        readOnly: "You have read access. Creating and editing events requires Company calendar add-on access.",
        titleField: "Event title",
        description: "Description",
        location: "Location / link",
        from: "From",
        to: "To",
        startTime: "Start",
        endTime: "End",
        allDay: "All day",
        people: "Included employees",
        positions: "Included positions",
        create: "Add event",
        save: "Save",
        delete: "Remove",
        optional: "optional",
        noEvents: "No events in this range.",
        globalEvent: "All employees",
        createdBy: "Created by"
      };
}

function selectedUserIds(event?: CompanyCalendarItem) {
  return event?.participants.map((participant) => participant.id) ?? [];
}

function selectedPositionIds(event?: CompanyCalendarItem) {
  return event?.positions.map((position) => position.id) ?? [];
}

function timeFromLabel(label: string, fallback: string) {
  const match = String(label || "").match(/\s(\d{2}:\d{2})$/);
  return match?.[1] ?? fallback;
}

function EventForm({
  copy,
  pickerData,
  event,
  action,
  submitLabel
}: {
  copy: ReturnType<typeof copyFor>;
  pickerData: CompanyCalendarPickerData;
  event?: CompanyCalendarItem;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  return (
    <form className="stack" action={action}>
      {event ? <input type="hidden" name="eventId" value={event.eventId} /> : null}
      <div className="grid2">
        <label className="field">
          <span className="label">{copy.titleField}</span>
          <input className="input" name="title" type="text" maxLength={180} required defaultValue={event?.title ?? ""} />
        </label>
        <label className="field">
          <span className="label">{copy.location}</span>
          <input className="input" name="location" type="text" maxLength={240} placeholder={copy.optional} defaultValue={event?.location ?? ""} />
        </label>
        <label className="field">
          <span className="label">{copy.from}</span>
          <input className="input" name="fromIso" type="date" required defaultValue={event?.fromIso ?? formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd")} />
        </label>
        <label className="field">
          <span className="label">{copy.to}</span>
          <input className="input" name="toIso" type="date" required defaultValue={event?.toIso ?? formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd")} />
        </label>
        <label className="field">
          <span className="label">{copy.startTime}</span>
          <input className="input" name="startTime" type="time" defaultValue={event && !event.allDay ? timeFromLabel(event.startLabel, "09:00") : "09:00"} />
        </label>
        <label className="field">
          <span className="label">{copy.endTime}</span>
          <input className="input" name="endTime" type="time" defaultValue={event && !event.allDay ? timeFromLabel(event.endLabel, "10:00") : "10:00"} />
        </label>
        <label className="field">
          <span className="label">{copy.allDay}</span>
          <label className="inline" style={{ alignItems: "center" }}>
            <input name="allDay" type="checkbox" value="1" defaultChecked={event ? event.allDay : true} />
            <span className="muted small">{copy.allDay}</span>
          </label>
        </label>
        <label className="field">
          <span className="label">{copy.description}</span>
          <textarea className="input" name="description" rows={3} maxLength={2000} placeholder={copy.optional} defaultValue={event?.description ?? ""} />
        </label>
        <label className="field">
          <span className="label">{copy.people}</span>
          <select className="input" name="userIds" multiple size={8} defaultValue={selectedUserIds(event)}>
            {pickerData.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email}){user.teamName ? ` · ${user.teamName}` : ""}{user.position ? ` · ${user.position}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{copy.positions}</span>
          <select className="input" name="positionIds" multiple size={8} defaultValue={selectedPositionIds(event)}>
            {pickerData.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.title} · {position.tier}{position.teamName ? ` · ${position.teamName}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="button" type="submit">{submitLabel}</button>
    </form>
  );
}

export default async function CompanyCalendarPage({
  searchParams
}: {
  searchParams: { fromIso?: string; toIso?: string; success?: string; error?: string };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const copy = copyFor(lang);
  const rangeDefault = defaultMonthRange();
  const fromIso = String(searchParams.fromIso || rangeDefault.fromIso).trim();
  const toIso = String(searchParams.toIso || rangeDefault.toIso).trim();
  const canManage = canManageCompanyCalendar(user);

  const [calendar, pickerData] = await Promise.all([
    getCompanyCalendar({ range: { fromIso, toIso } }),
    canManage ? getCompanyCalendarPickerData() : Promise.resolve({ users: [], positions: [] })
  ]);

  const events = calendar.ok ? calendar.items : [];
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
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <GuidancePanel title={copy.guideTitle} description={copy.guideDescription} items={copy.guideItems} />

        <section id="calendar" className="panel stack">
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
          <CompanyCalendarView lang={lang} timeZone={APP_TIMEZONE} fromIso={fromIso} toIso={toIso} items={events} />
        </section>

        {canManage ? (
          <section className="panel stack">
            <h2 className="h2">{copy.newEvent}</h2>
            <EventForm copy={copy} pickerData={pickerData} action={createCompanyEventAction} submitLabel={copy.create} />
          </section>
        ) : (
          <section className="panel stack">
            <div className="notice notice-muted"><div className="muted small">{copy.readOnly}</div></div>
          </section>
        )}

        {canManage ? (
          <section className="panel stack">
            <h2 className="h2">{copy.manageEvents}</h2>
            {events.length === 0 ? <div className="muted">{copy.noEvents}</div> : null}
            <div className="list">
              {events.map((event) => (
                <details key={event.eventId} className="item stack">
                  <summary className="item-top" style={{ cursor: "pointer" }}>
                    <div>
                      <div className="item-title">{event.title}</div>
                      <div className="muted small">
                        {event.startLabel} → {event.endLabel}{event.location ? ` · ${event.location}` : ""}
                      </div>
                      <div className="muted small">
                        {event.participants.length || event.positions.length
                          ? `${event.participants.length} ljudi · ${event.positions.length} pozicija`
                          : copy.globalEvent}
                        {event.createdBy ? ` · ${copy.createdBy}: ${event.createdBy.name}` : ""}
                      </div>
                    </div>
                    <div className="pills"><span className="pill absence-legend annual">{copy.calendar}</span></div>
                  </summary>
                  <EventForm copy={copy} pickerData={pickerData} event={event} action={updateCompanyEventAction} submitLabel={copy.save} />
                  <form action={deleteCompanyEventAction}>
                    <input type="hidden" name="eventId" value={event.eventId} />
                    <button className="button button-danger" type="submit">{copy.delete}</button>
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
