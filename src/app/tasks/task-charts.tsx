"use client";

import { useMemo, useState } from "react";
import { getI18n, type Lang } from "@/i18n";

type Item = { label: string; value: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function DonutChart({
  title,
  items,
  palette,
  emptyText,
  centerLabel
}: {
  title: string;
  items: Item[];
  palette: string[];
  emptyText: string;
  centerLabel: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = hover ?? selected;
  const resolvedPalette = useMemo(() => (palette.length ? palette : ["#F05123"]), [palette]);
  const total = useMemo(() => items.reduce((s, x) => s + Number(x.value || 0), 0), [items]);

  const slices = useMemo(() => {
    if (!total) return [];
    const gap = 2.2;
    let angle = 0;
    return items
      .filter((x) => Number(x.value || 0) > 0)
      .map((x, i) => {
        const value = Number(x.value || 0);
        const sweep = (value / total) * 360;
        const start = angle;
        const end = angle + sweep;
        angle += sweep;
        const hasGap = sweep > gap * 1.15;
        return {
          ...x,
          startAngle: hasGap ? start + gap / 2 : start,
          endAngle: hasGap ? end - gap / 2 : end,
          color: resolvedPalette[i % resolvedPalette.length]
        };
      });
  }, [items, resolvedPalette, total]);

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 30;
  const r = (size - stroke) / 2;

  const activeSlice = useMemo(() => (active ? slices.find((s) => s.label === active) ?? null : null), [active, slices]);
  const activePct = activeSlice && total ? Math.round(((activeSlice.value / total) * 1000)) / 10 : null;

  function clipCenterLabel(text: string) {
    const s = String(text || "").trim();
    if (s.length <= 22) return s;
    return `${s.slice(0, 21)}…`;
  }

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {!total ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <div className="chart-grid">
          <svg className="donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255 255 255 / 0.08)" strokeWidth={stroke} />
            {slices.map((s) => (
              <path
                key={s.label}
                d={describeArc(cx, cy, r, s.startAngle, s.endAngle)}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelected((prev) => (prev === s.label ? null : s.label))}
                style={{
                  cursor: "pointer",
                  opacity: active && active !== s.label ? 0.14 : 1,
                  filter: active === s.label ? "drop-shadow(0 14px 24px rgba(0,0,0,0.7))" : undefined
                }}
              />
            ))}
            <circle cx={cx} cy={cy} r={r - stroke / 2} fill="transparent" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={900} fill="white">
              {activeSlice ? clamp(activeSlice.value, 0, 999999) : total}
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize={12} fill="rgba(255 255 255 / 0.75)">
              {activeSlice
                ? `${clipCenterLabel(activeSlice.label)}${activePct != null ? ` · ${activePct}%` : ""}`
                : centerLabel}
            </text>
          </svg>

          <div className="legend">
            {slices.map((s) => (
              <button
                key={s.label}
                type="button"
                className={`legend-item${active === s.label ? " legend-item-active" : ""}`}
                onMouseEnter={() => setHover(s.label)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.label)}
                onBlur={() => setHover(null)}
                onClick={() => setSelected((prev) => (prev === s.label ? null : s.label))}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  opacity: active && active !== s.label ? 0.45 : 1
                }}
              >
                <span className="legend-swatch" style={{ background: s.color }} />
                <span className="legend-text">
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-value">
                    {clamp(s.value, 0, 999999)}
                    {total ? (
                      <span style={{ opacity: 0.75 }}> ({Math.round((s.value / total) * 1000) / 10}%)</span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeLabel(lang: Lang, label: string) {
  const t = getI18n(lang);
  const key = String(label || "").trim().toLowerCase();
  const map: Record<string, string> = {
    approved: t.tasks.chartLabels.approved,
    open: t.tasks.chartLabels.open,
    returned: t.tasks.chartLabels.returned,
    "approved on time": t.tasks.chartLabels.approvedOnTime,
    "approved after deadline": t.tasks.chartLabels.approvedAfterDeadline
  };
  return map[key] || label;
}

export default function TaskCharts({
  lang,
  palette,
  status,
  approved,
  tri
}: {
  lang: Lang;
  palette: string[];
  status: Item[];
  approved: Item[];
  tri: Item[];
}) {
  const t = getI18n(lang);
  return (
    <section className="charts">
      <DonutChart
        title={t.tasks.charts.status}
        items={status.map((x) => ({ ...x, label: normalizeLabel(lang, x.label) }))}
        palette={palette}
        emptyText={t.tasks.charts.empty}
        centerLabel={t.tasks.charts.totalTasks}
      />
      <DonutChart
        title={t.tasks.charts.approval}
        items={approved.map((x) => ({ ...x, label: normalizeLabel(lang, x.label) }))}
        palette={palette}
        emptyText={t.tasks.charts.empty}
        centerLabel={t.tasks.charts.totalTasks}
      />
      <DonutChart
        title={t.tasks.charts.onTime}
        items={tri.map((x) => ({ ...x, label: normalizeLabel(lang, x.label) }))}
        palette={palette}
        emptyText={t.tasks.charts.empty}
        centerLabel={t.tasks.charts.totalApprovals}
      />
    </section>
  );
}
