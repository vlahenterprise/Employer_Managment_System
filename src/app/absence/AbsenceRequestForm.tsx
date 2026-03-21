"use client";

import { useEffect, useMemo, useState } from "react";
import { IconAlertTriangle, IconCheckCircle } from "@/components/icons";
import { getI18n, type Lang } from "@/i18n";

type OverlapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; count: number; names: string[] };

type Props = {
  lang: Lang;
  timeZone: string;
  action: (formData: FormData) => void | Promise<void>;
};

export default function AbsenceRequestForm({ lang, timeZone, action }: Props) {
  const t = getI18n(lang);
  const [type, setType] = useState("ANNUAL_LEAVE");
  const [fromIso, setFromIso] = useState("");
  const [toIso, setToIso] = useState("");
  const [comment, setComment] = useState("");
  const [overlap, setOverlap] = useState<OverlapState>({ status: "idle" });

  const normalizedRange = useMemo(() => {
    const start = fromIso.trim();
    const end = (type === "SLAVA" ? fromIso : toIso).trim();
    if (!start || !end) return null;
    return start <= end ? { fromIso: start, toIso: end } : { fromIso: end, toIso: start };
  }, [fromIso, toIso, type]);

  useEffect(() => {
    if (type === "SLAVA" && fromIso) {
      setToIso(fromIso);
    }
  }, [type, fromIso]);

  useEffect(() => {
    if (!normalizedRange) {
      setOverlap({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setOverlap({ status: "loading" });
        const params = new URLSearchParams(normalizedRange);
        const res = await fetch(`/api/absence/check-overlap?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store"
        });

        if (!res.ok) {
          setOverlap({ status: "error" });
          return;
        }

        const data = (await res.json()) as { ok: boolean; count?: number; names?: string[] };
        if (!data.ok) {
          setOverlap({ status: "error" });
          return;
        }

        setOverlap({
          status: "ready",
          count: Number(data.count || 0),
          names: Array.isArray(data.names) ? data.names.slice(0, 5) : []
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setOverlap({ status: "error" });
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalizedRange]);

  const hiddenToIso = type === "SLAVA" ? fromIso : toIso;
  const overlapExtra = overlap.status === "ready" ? Math.max(0, overlap.count - overlap.names.length) : 0;

  return (
    <form className="stack" action={action}>
      <div className="muted small">{t.absence.requestHint}</div>

      <div className="grid3">
        <label className="field">
          <span className="label">{t.absence.type}</span>
          <select className="input" name="type" value={type} onChange={(e) => setType(e.target.value)} required>
            <option value="ANNUAL_LEAVE">{t.absence.typeAnnual}</option>
            <option value="HOME_OFFICE">{t.absence.typeHome}</option>
            <option value="SLAVA">{t.absence.typeSlava}</option>
            <option value="SICK">{t.absence.typeSick}</option>
            <option value="OTHER">{t.absence.typeOther}</option>
          </select>
        </label>
        <label className="field">
          <span className="label">{t.absence.from}</span>
          <input className="input" name="fromIso" type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} required />
        </label>
        <label className="field">
          <span className="label">{t.absence.to}</span>
          <input
            className="input"
            name={type === "SLAVA" ? "_toIsoVisible" : "toIso"}
            type="date"
            value={type === "SLAVA" ? fromIso : toIso}
            onChange={(e) => setToIso(e.target.value)}
            required={type !== "SLAVA"}
            disabled={type === "SLAVA"}
          />
          {type === "SLAVA" ? <input type="hidden" name="toIso" value={hiddenToIso} /> : null}
        </label>
      </div>

      {overlap.status !== "idle" ? (
        <div className={`notice ${overlap.status === "ready" && overlap.count > 0 ? "notice-warning" : "notice-neutral"}`}>
          <div className="notice-icon">
            {overlap.status === "ready" && overlap.count === 0 ? <IconCheckCircle size={18} /> : <IconAlertTriangle size={18} />}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="notice-title">{t.absence.overlapPreviewTitle}</div>
            {overlap.status === "loading" ? <div className="muted small">{t.absence.overlapPreviewChecking}</div> : null}
            {overlap.status === "error" ? <div className="muted small">{t.absence.overlapPreviewChecking}</div> : null}
            {overlap.status === "ready" && overlap.count > 0 ? (
              <>
                <div className="small">{t.absence.overlapPreviewDetected}</div>
                <div className="small muted">
                  {t.absence.overlapPreviewNames} {overlap.names.join(", ")}
                  {overlapExtra > 0 ? ` ${t.absence.overlapPreviewMore(overlapExtra)}` : ""}
                </div>
              </>
            ) : null}
            {overlap.status === "ready" && overlap.count === 0 ? <div className="small">{t.absence.overlapPreviewClear}</div> : null}
          </div>
        </div>
      ) : null}

      <label className="field">
        <span className="label">{t.absence.comment}</span>
        <textarea
          className="input"
          name="comment"
          rows={3}
          style={{ resize: "vertical" }}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <button className="button" type="submit">
        {t.absence.submit}
      </button>
      <div className="muted small">{t.absence.tzNote(timeZone)}</div>
    </form>
  );
}
