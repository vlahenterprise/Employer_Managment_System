"use client";

import { useState } from "react";
import type { CompanyCalendarItem, CompanyCalendarPickerData } from "@/server/company-calendar";

const EVENT_TYPE_OPTIONS = [
  { value: "orange", sr: "Konferencija", en: "Conference", hex: "#f05123" },
  { value: "blue", sr: "Vebinar", en: "Webinar", hex: "#3b82f6" },
  { value: "blue", sr: "Online konferencija", en: "Online conference", hex: "#3b82f6" },
  { value: "purple", sr: "Radionice", en: "Workshops", hex: "#a855f7" },
  { value: "red", sr: "Q&A Sesija", en: "Q&A Session", hex: "#ef4444" },
  { value: "green", sr: "Timske aktivnosti", en: "Team activities", hex: "#22c55e" },
  { value: "teal", sr: "Team Building", en: "Team Building", hex: "#14b8a6" },
  { value: "pink", sr: "Onboarding klijenata", en: "Client onboarding", hex: "#ec4899" },
  { value: "yellow", sr: "Kompanijski odmor", en: "Company holiday", hex: "#eab308" },
  { value: "orange", sr: "Ostalo", en: "Other", hex: "#f05123" },
];

function selectedUserIds(event?: CompanyCalendarItem) {
  return new Set(event?.participants.map((p) => p.id) ?? []);
}

function selectedPositionIds(event?: CompanyCalendarItem) {
  return new Set(event?.positions.map((p) => p.id) ?? []);
}

export default function CompanyEventForm({
  pickerData,
  event,
  action,
  submitLabel,
  lang,
  defaultFromIso,
}: {
  pickerData: CompanyCalendarPickerData;
  event?: CompanyCalendarItem;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  lang: "sr" | "en";
  defaultFromIso: string;
}) {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => selectedUserIds(event));
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(() => selectedPositionIds(event));
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(() => {
    const existingColor = event?.color ?? "orange";
    const idx = EVENT_TYPE_OPTIONS.findIndex((t) => t.value === existingColor);
    return idx >= 0 ? idx : 0;
  });
  const [allDay, setAllDay] = useState(event ? event.allDay : true);

  const selectedColor = EVENT_TYPE_OPTIONS[selectedTypeIndex]?.value ?? "orange";
  const selectedHex = EVENT_TYPE_OPTIONS[selectedTypeIndex]?.hex ?? "#f05123";

  function addTeam(teamId: string) {
    const team = pickerData.teams?.find((t) => t.id === teamId);
    if (!team) return;
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      for (const uid of team.userIds) next.add(uid);
      return next;
    });
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function togglePosition(positionId: string) {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
  }

  const copy = {
    titleField: lang === "sr" ? "Naziv događaja" : "Event title",
    location: lang === "sr" ? "Lokacija / link" : "Location / link",
    from: lang === "sr" ? "Od" : "From",
    to: lang === "sr" ? "Do" : "To",
    startTime: lang === "sr" ? "Početak" : "Start time",
    endTime: lang === "sr" ? "Kraj" : "End time",
    allDay: lang === "sr" ? "Ceo dan" : "All day",
    description: lang === "sr" ? "Opis" : "Description",
    eventTypeLabel: lang === "sr" ? "Tip događaja" : "Event type",
    peopleLabel: lang === "sr" ? "Uključeni zaposleni" : "Included employees",
    positionsLabel: lang === "sr" ? "Uključene pozicije" : "Included positions",
    quickAddTeam: lang === "sr" ? "Dodaj ceo tim" : "Add whole team",
    selectTeam: lang === "sr" ? "— Izaberi tim —" : "— Select team —",
    optional: lang === "sr" ? "opciono" : "optional",
    selected: lang === "sr" ? "izabrano" : "selected",
  };

  return (
    <form className="stack" action={action}>
      {event ? <input type="hidden" name="eventId" value={event.eventId} /> : null}

      {/* Hidden fields for selected IDs */}
      {[...selectedUsers].map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}
      {[...selectedPositions].map((id) => (
        <input key={id} type="hidden" name="positionIds" value={id} />
      ))}
      <input type="hidden" name="color" value={selectedColor} />
      <input type="hidden" name="allDay" value={allDay ? "1" : "0"} />

      <div className="grid2">
        <label className="field">
          <span className="label">{copy.titleField}</span>
          <input className="input" name="title" type="text" maxLength={180} required defaultValue={event?.title ?? ""} />
        </label>
        <label className="field">
          <span className="label">
            {copy.location} <span className="muted small">({copy.optional})</span>
          </span>
          <input className="input" name="location" type="text" maxLength={240} defaultValue={event?.location ?? ""} />
        </label>
        <label className="field">
          <span className="label">{copy.from}</span>
          <input className="input" name="fromIso" type="date" required defaultValue={event?.fromIso ?? defaultFromIso} />
        </label>
        <label className="field">
          <span className="label">{copy.to}</span>
          <input className="input" name="toIso" type="date" required defaultValue={event?.toIso ?? defaultFromIso} />
        </label>

        <label className="field" style={{ alignItems: "flex-start" }}>
          <span className="label">{copy.allDay}</span>
          <label className="inline" style={{ alignItems: "center", marginTop: 4 }}>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            <span className="muted small">{copy.allDay}</span>
          </label>
        </label>

        {!allDay ? (
          <>
            <label className="field">
              <span className="label">{copy.startTime}</span>
              <input
                className="input"
                name="startTime"
                type="time"
                defaultValue={event && !event.allDay ? event.startLabel.slice(-5) : "09:00"}
              />
            </label>
            <label className="field">
              <span className="label">{copy.endTime}</span>
              <input
                className="input"
                name="endTime"
                type="time"
                defaultValue={event && !event.allDay ? event.endLabel.slice(-5) : "10:00"}
              />
            </label>
          </>
        ) : null}

        <label className="field">
          <span className="label">
            {copy.description} <span className="muted small">({copy.optional})</span>
          </span>
          <textarea className="input" name="description" rows={2} maxLength={2000} defaultValue={event?.description ?? ""} />
        </label>

        {/* Event type selector */}
        <div className="field">
          <span className="label">{copy.eventTypeLabel}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              className="input"
              value={selectedTypeIndex}
              onChange={(e) => setSelectedTypeIndex(Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {EVENT_TYPE_OPTIONS.map((t, i) => (
                <option key={i} value={i}>
                  {lang === "sr" ? t.sr : t.en}
                </option>
              ))}
            </select>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: selectedHex,
                flexShrink: 0,
                display: "inline-block",
                border: "2px solid rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Team quick-add */}
      {pickerData.teams && pickerData.teams.length > 0 ? (
        <div className="field">
          <span className="label">{copy.quickAddTeam}</span>
          <select
            className="input"
            style={{ maxWidth: 260 }}
            value=""
            onChange={(e) => {
              if (e.target.value) addTeam(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">{copy.selectTeam}</option>
            {pickerData.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* People multiselect */}
      <div className="field">
        <span className="label">
          {copy.peopleLabel}
          {selectedUsers.size > 0 ? (
            <span className="tag tag-small" style={{ marginLeft: 8 }}>
              {selectedUsers.size} {copy.selected}
            </span>
          ) : null}
        </span>
        <div className="participant-list">
          {pickerData.users.map((user) => (
            <label
              key={user.id}
              className={`participant-item${selectedUsers.has(user.id) ? " participant-item-selected" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedUsers.has(user.id)}
                onChange={() => toggleUser(user.id)}
                className="sr-only"
              />
              <span className="participant-name">{user.name}</span>
              {user.teamName ? <span className="participant-team">{user.teamName}</span> : null}
            </label>
          ))}
        </div>
      </div>

      {/* Positions multiselect */}
      {pickerData.positions.length > 0 ? (
        <div className="field">
          <span className="label">
            {copy.positionsLabel}
            {selectedPositions.size > 0 ? (
              <span className="tag tag-small" style={{ marginLeft: 8 }}>
                {selectedPositions.size} {copy.selected}
              </span>
            ) : null}
          </span>
          <div className="participant-list">
            {pickerData.positions.map((pos) => (
              <label
                key={pos.id}
                className={`participant-item${selectedPositions.has(pos.id) ? " participant-item-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPositions.has(pos.id)}
                  onChange={() => togglePosition(pos.id)}
                  className="sr-only"
                />
                <span className="participant-name">{pos.title}</span>
                {pos.teamName ? <span className="participant-team">{pos.teamName}</span> : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <button className="button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
