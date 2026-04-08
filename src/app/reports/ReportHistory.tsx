"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
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

  const analytics = useMemo(() => {
    if (reports.length === 0) return null;
    const totalMinutes = reports.reduce((s, r) => s + r.totalMinutes, 0);

    // Aggregate by activity type
    const typeMap = new Map<string, number>();
    for (const r of reports) {
      for (const a of r.activities) {
        typeMap.set(a.type, (typeMap.get(a.type) ?? 0) + a.minutes);
      }
    }
    const sorted = [...typeMap.entries()]
      .map(([type, minutes]) => ({ type, minutes }))
      .sort((a, b) => b.minutes - a.minutes);

    const topMost = sorted.slice(0, 5);
    const topLeast = sorted.length >= 6 ? [...sorted].reverse().slice(0, 5) : [];
    const maxMinutes = sorted[0]?.minutes ?? 1;

    return { totalMinutes, topMost, topLeast, maxMinutes };
  }, [reports]);

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

      {loaded && analytics ? (
        <div className="stack">
          <div className="grid3 reports-kpi-grid">
            <div className="item item-compact kpi-card">
              <div>
                <div className="kpi-value">{Math.floor(analytics.totalMinutes / 60)}h {String(analytics.totalMinutes % 60).padStart(2, "0")}m</div>
                <div className="kpi-label">{lang === "sr" ? "Ukupno u periodu" : "Total in period"}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div>
                <div className="kpi-value">{reports.length}</div>
                <div className="kpi-label">{lang === "sr" ? "Izveštaja" : "Reports"}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div>
                <div className="kpi-value">{analytics.topMost.length > 0 ? analytics.topMost[0].type : "—"}</div>
                <div className="kpi-label">{lang === "sr" ? "Najčešća aktivnost" : "Top activity"}</div>
              </div>
            </div>
          </div>

          <div className="grid2">
            <div className="item stack">
              <div className="section-header">
                <h3 className="section-title" style={{fontSize: "14px"}}>{lang === "sr" ? "Top 5 aktivnosti" : "Top 5 activities"}</h3>
              </div>
              <div className="rank-list">
                {analytics.topMost.map((x, i) => {
                  const pct = Math.round((x.minutes / analytics.maxMinutes) * 100);
                  return (
                    <div key={x.type} className="rank-row">
                      <div className="rank-badge">{i + 1}</div>
                      <div className="rank-body">
                        <div className="rank-title">{x.type}</div>
                        <div className="rank-bar"><span style={{ width: `${pct}%` }} /></div>
                      </div>
                      <div className="rank-value">{Math.floor(x.minutes / 60)}h {String(x.minutes % 60).padStart(2, "0")}m</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {analytics.topLeast.length > 0 ? (
              <div className="item stack">
                <div className="section-header">
                  <h3 className="section-title" style={{fontSize: "14px"}}>{lang === "sr" ? "Najmanje 5 aktivnosti" : "Bottom 5 activities"}</h3>
                </div>
                <div className="rank-list">
                  {analytics.topLeast.map((x, i) => {
                    const pct = Math.round((x.minutes / analytics.maxMinutes) * 100);
                    return (
                      <div key={x.type} className="rank-row">
                        <div className="rank-badge">{i + 1}</div>
                        <div className="rank-body">
                          <div className="rank-title">{x.type}</div>
                          <div className="rank-bar"><span style={{ width: `${pct}%` }} /></div>
                        </div>
                        <div className="rank-value">{Math.floor(x.minutes / 60)}h {String(x.minutes % 60).padStart(2, "0")}m</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
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
