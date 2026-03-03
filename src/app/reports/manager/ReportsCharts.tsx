"use client";

import { useMemo } from "react";

type Item = { type: string; minutes: number };

function BarListChart({
  title,
  items,
  emptyText
}: {
  title: string;
  items: Item[];
  emptyText: string;
}) {
  const max = useMemo(() => Math.max(1, ...items.map((x) => Number(x.minutes || 0))), [items]);

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {items.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <div className="bars">
          {items.map((x, i) => {
            const pct = Math.round((Number(x.minutes || 0) / max) * 100);
            return (
              <div key={`${x.type}-${i}`} className="bar-row bar-row-lg">
                <div className="bar-label">
                  <span className="bar-rank">{i + 1}</span>
                  <span className="bar-label-text">{x.type}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="bar-value">{x.minutes}m</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportsCharts({
  topMost,
  topLeast,
  chart,
  titles,
  emptyText
}: {
  topMost: Item[];
  topLeast: Item[];
  chart: Item[];
  titles: { topMost: string; topLeast: string; all: string };
  emptyText: string;
}) {
  return (
    <section className="charts">
      <BarListChart title={titles.topMost} items={topMost} emptyText={emptyText} />
      <BarListChart title={titles.topLeast} items={topLeast} emptyText={emptyText} />
      <BarListChart title={titles.all} items={chart.slice(0, 12)} emptyText={emptyText} />
    </section>
  );
}
