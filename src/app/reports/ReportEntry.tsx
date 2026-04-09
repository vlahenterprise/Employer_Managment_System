"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { checkDailyReportAction, checkReportExemptAction, deleteDailyReportAction, saveDailyReportAction } from "./actions";
import { getI18n, Lang } from "@/i18n";
import { IconPlus, IconSave, IconTrash } from "@/components/icons";

type Activity = {
  type: string;
  desc: string;
  minutes: number;
};

export default function ReportEntry(props: {
  lang: Lang;
  activityTypes: string[];
  rules: { minH: number; maxH: number; maxAct: number };
}) {
  const t = getI18n(props.lang);
  const defaultDateIso = useMemo(
    () => new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    []
  );
  const [dateIso, setDateIso] = useState(defaultDateIso);
  const [exists, setExists] = useState<boolean | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [initialized, setInitialized] = useState(false);
  const [exempt, setExempt] = useState<{ exempt: boolean; reason?: string } | null>(null);

  const totalMinutes = useMemo(() => activities.reduce((sum, a) => sum + Number(a.minutes || 0), 0), [activities]);

  function setActivity(i: number, patch: Partial<Activity>) {
    setActivities((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function addActivity() {
    if (activities.length >= props.rules.maxAct) {
      setMessage(t.reports.msgMaxActivities(props.rules.maxAct));
      setMessageType("error");
      return;
    }
    setActivities((prev) => [...prev, { type: "", desc: "", minutes: 0 }]);
  }

  function removeActivity(i: number) {
    setActivities((prev) => prev.filter((_, idx) => idx !== i));
  }

  const onDateChange = useCallback((next: string) => {
    const trimmed = next.trim();
    setDateIso(trimmed);
    setExists(null);
    setActivities([]);
    setMessage("");
    setMessageType(null);
    setExempt(null);
    if (!trimmed) return;

    startTransition(async () => {
      const res = await checkDailyReportAction(trimmed);
      if (!res.ok) {
        setExists(null);
        setMessage(t.reports.msgInvalidDate);
        setMessageType("error");
        return;
      }
      setExists(res.exists);
      setMessage(res.exists ? t.reports.msgReportExists : "");
      setMessageType(res.exists ? "error" : null);
      const exemptRes = await checkReportExemptAction(trimmed);
      setExempt(exemptRes);
    });
  }, [t.reports]);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    if (dateIso) onDateChange(dateIso);
  }, [dateIso, initialized, onDateChange]);

  function errorMessage(error: string | undefined | null) {
    const code = String(error || "");
    if (code === "INVALID_DATE") return t.reports.msgInvalidDate;
    if (code === "FUTURE_DATE") return t.reports.msgFutureDate;
    if (code === "MIN_HOURS") return t.reports.msgMinHours(props.rules.minH);
    if (code === "MAX_HOURS") return t.reports.msgMaxHours(props.rules.maxH);
    if (code === "MAX_ACTIVITIES") return t.reports.msgMaxActivities(props.rules.maxAct);
    if (code === "EXISTS") return t.reports.msgReportExists;
    if (code === "MISSING_ACTIVITY_TYPE") return t.reports.msgMissingType;
    if (code === "MISSING_DESCRIPTION") return t.reports.msgMissingDescription;
    if (code === "INVALID_DURATION") return t.reports.msgInvalidDuration;
    if (code === "NO_ACTIVITIES") return t.reports.msgPleaseAddActivity;
    return t.reports.msgSaveError;
  }

  function onSave() {
    setMessage("");
    setMessageType(null);
    if (!dateIso) {
      setMessage(t.reports.msgPleaseSelectDate);
      setMessageType("error");
      return;
    }
    if (activities.length === 0) {
      setMessage(t.reports.msgPleaseAddActivity);
      setMessageType("error");
      return;
    }

    startTransition(async () => {
      const res = await saveDailyReportAction({
        dateIso,
        activities: activities.map((a) => ({
          type: a.type,
          desc: a.desc,
          minutes: Number(a.minutes || 0)
        }))
      });
      if (!res.ok) {
        setMessage(errorMessage(res.error));
        setMessageType("error");
        return;
      }
      setExists(true);
      setActivities([]);
      setMessage(t.reports.msgSaved(res.saved, res.reportId));
      setMessageType("success");
    });
  }

  function onDelete() {
    if (!dateIso) return;
    const ok1 = confirm(t.reports.deleteConfirm1(dateIso));
    if (!ok1) return;
    const ok2 = confirm(t.reports.deleteConfirm2);
    if (!ok2) return;

    setMessage("");
    setMessageType(null);
    startTransition(async () => {
      const res = await deleteDailyReportAction({ dateIso });
      if (!res.ok) {
        setMessage(t.reports.msgCannotDelete);
        setMessageType("error");
        return;
      }
      setExists(false);
      setActivities([]);
      setMessage(t.reports.msgDeleted);
      setMessageType("success");
    });
  }

  return (
    <section className="panel stack">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 className="h2">{t.reports.entryTitle}</h2>
          <div className="muted small">
            {t.reports.rules(props.rules.minH, props.rules.maxH, props.rules.maxAct)}
          </div>
        </div>
        <div className="inline">
          {exists ? (
            <button className="button button-danger" type="button" onClick={onDelete} disabled={isPending}>
              <IconTrash size={16} /> {t.reports.deleteReport}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid2">
        <label className="field">
          <span className="label">{t.reports.date}</span>
          <input className="input" type="date" value={dateIso} onChange={(e) => onDateChange(e.target.value)} />
        </label>

        <div className="field">
          <span className="label">{t.reports.total}</span>
          <div className="input" style={{ display: "flex", alignItems: "center" }}>
            {Math.floor(totalMinutes / 60)}h {String(totalMinutes % 60).padStart(2, "0")}m ({totalMinutes} min)
          </div>
        </div>
      </div>

      {props.activityTypes.length === 0 ? (
        <div className="muted small">{t.reports.noActivityTypes}</div>
      ) : null}

      <div className="stack">
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <div className="h2">{t.reports.activities}</div>
            <button className="button button-secondary" type="button" onClick={addActivity} disabled={isPending || !!exists}>
              <IconPlus size={16} /> {t.reports.addActivity}
            </button>
          </div>

        {activities.length === 0 ? <div className="muted">{t.reports.noActivitiesYet}</div> : null}

        <div className="list">
          {activities.map((a, i) => (
            <div key={i} className="item stack">
              <div className="grid3">
                <label className="field">
                  <span className="label">{t.reports.type}</span>
                  <select
                    className="input"
                    value={a.type}
                    onChange={(e) => setActivity(i, { type: e.target.value })}
                  >
                    <option value="">(select)</option>
                    {props.activityTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">{t.reports.minutes}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={a.minutes || ""}
                    onChange={(e) => setActivity(i, { minutes: Number(e.target.value) })}
                  />
                </label>

                <div className="field field-actions">
                  <span className="label"> </span>
                  <button className="button button-danger" type="button" onClick={() => removeActivity(i)} disabled={isPending}>
                    <IconTrash size={16} /> {t.reports.remove}
                  </button>
                </div>
              </div>

              <label className="field">
                <span className="label">{t.reports.description}</span>
                <textarea
                  className="input textarea"
                  rows={3}
                  value={a.desc}
                  onChange={(e) => setActivity(i, { desc: e.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {message ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

      {exempt?.exempt ? (
        <div className="muted small" style={{ padding: "6px 0" }}>
          ⚠️{" "}
          {exempt.reason === "WEEKEND"
            ? "Vikend — unos je opcionalan, nema podsetnika"
            : exempt.reason === "ANNUAL_LEAVE" || exempt.reason === "SICK"
              ? "Na odmoru/bolovanju — izveštaj nije potreban za ovaj dan"
              : (exempt.reason?.startsWith("COMPANY_EVENT:"))
                ? "Kompanijski slobodan dan — izveštaj nije potreban"
                : null}
        </div>
      ) : null}

      <div className="inline">
        <button className="button" type="button" onClick={onSave} disabled={isPending || !!exists}>
          <IconSave size={16} /> {isPending ? t.reports.saving : t.reports.saveReport}
        </button>
        {exists ? <div className="muted small">{t.reports.reportAlreadyExists}</div> : null}
      </div>
    </section>
  );
}
