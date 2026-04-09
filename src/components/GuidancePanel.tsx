import type { ReactNode } from "react";
import { IconSparkles } from "@/components/icons";

type GuidancePanelProps = {
  title: string;
  description?: string;
  items?: string[];
  tone?: "info" | "warning" | "neutral";
  children?: ReactNode;
};

export function GuidancePanel({
  title,
  description,
  items = [],
  tone = "info",
  children
}: GuidancePanelProps) {
  const toneClass = tone === "warning" ? "notice-warning" : tone === "neutral" ? "notice-neutral" : "notice-info";

  return (
    <details className={`notice guidance-panel ${toneClass}`}>
      <summary className="guidance-panel-summary">
        <div className="notice-icon">
          <IconSparkles size={18} />
        </div>
        <span className="notice-title">{title}</span>
        <span className="guidance-panel-caret" aria-hidden="true">▾</span>
      </summary>
      <div className="guidance-panel-body stack">
        {description ? <div className="muted small guidance-panel-description">{description}</div> : null}
        {items.length > 0 ? (
          <ul className="guidance-panel-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
    </details>
  );
}
