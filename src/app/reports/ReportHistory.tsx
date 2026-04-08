"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { getMyReportsInRangeAction, deleteDailyReportAction } from "./actions";
import { getI18n, Lang } from "@/i18n";
import { IconTrash } from "@/components/icons";

type ReportItem = {
  id: string;
  dateIso: string;
  totalMinutes: number;
  activities: Array<{ type: string; desc: string; minutes: number }>;
};

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function currentMonthRange() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`
  };
}

export default function ReportHistory({ lang }: { lang: Lang }) {
  const t = getI18n(lang);
  const range = currentMonthRange();
  const [fromIso, setFromIso] = useState(range.from);
  const [toIso, setToIso] = useState(range.to);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const load = useCallback((from: string, to: string) => {
    startTransition(async () => {
      const res = await getMyReportsInRangeAction({ fromIso: from, toIso: to });
      if (res.ok) {
        setReports(res.reports as ReportItem[]);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load(fromIso, toIso);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    setLoaded(false);
    load(fromIso, toIso);
  }

  function handleDelete(report: ReportItem) {
    const confirmMsg = lang === "sr"
      ? `Obriši izveštaj za ${report.dateIso}?`
      : `Delete report for ${report.dateIso}?`;
    if (!confirm(confirmMsg)) return;
    setDeletingId(report.id);
    startTransition(async () => {
      const res = await deleteDailyReportAction({ dateIso: report.dateIso });
      setDeletingId(null);
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== report.id));
        setMessage(lang === "sr" ? "Izveštaj obrisan." : "Report deleted.");
        setMessageType("success");
      } else {
        setMessage(lang === "sr" ? "Greška pri brisanju." : "Delete failed.");
        setMessageType("error");
      }
      setTimeout(() => { setMessage(""); setMessageType(null); }, 3000);
    });
  }

  void t;

  return (
    <div className="stack">
      <div className="section-header">
        <h2 className="section-title">{lang === "sr" ? "Istorija izveštaja" : "Report History"}</h2>
      </div>

      <div className="filter-bar">
        <label className="field">
          <span className="label">{lang === "sr" ? "Od" : "From"}</span>
          <input
            type="date"
            className="input"
            value={fromIso}
            onChange={e => setFromIso(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">{lang === "sr" ? "Do" : "To"}</span>
          <input
            type="date"
            className="input"
            value={toIso}
            onChange={e => setToIso(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-secondary"
          onClick={handleSearch}
          disabled={isPending}
        >
          {lang === "sr" ? "Prikaži" : "Show"}
        </button>
      </div>

      {message ? (
        <div className={`alert ${messageType === "success" ? "alert-ok" : "alert-error"}`}>
          {message}
        </div>
      ) : null}

      {!loaded ? (
        <div className="muted">{lang === "sr" ? "Učitavanje..." : "Loading..."}</div>
      ) : reports.length === 0 ? (
        <div className="muted">{lang === "sr" ? "Nema izveštaja u ovom periodu." : "No reports in this period."}</div>
      ) : (
        <div className="stack">
          {reports.map(report => (
            <div key={report.id} className="item item-compact">
              <div className="item-row">
                <div>
                  <div className="item-title">{report.dateIso}</div>
                  <div className="muted" style={{ fontSize: "13px" }}>
                    {formatMinutes(report.totalMinutes)} · {report.activities.length} {lang === "sr" ? "aktivnosti" : "activities"}
                  </div>
                  <div className="report-activities">
                    {report.activities.map((a, i) => (
                      <div key={i} className="report-activity-row">
                        <span className="tag tag-small">{a.type}</span>
                        <span className="muted" style={{ fontSize: "12px" }}>{a.desc}</span>
                        <span className="muted" style={{ fontSize: "12px" }}>{a.minutes}m</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="button button-danger-ghost"
                  onClick={() => handleDelete(report)}
                  disabled={isPending && deletingId === report.id}
                  title={lang === "sr" ? "Obriši izveštaj" : "Delete report"}
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
