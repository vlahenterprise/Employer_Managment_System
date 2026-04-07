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
    <div className={`notice guidance-panel ${toneClass}`}>
      <div className="notice-icon">
        <IconSparkles size={18} />
      </div>
      <div className="stack">
        <div>
          <div className="notice-title">{title}</div>
          {description ? <div className="muted small guidance-panel-description">{description}</div> : null}
        </div>
        {items.length > 0 ? (
          <ul className="guidance-panel-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
    </div>
  );
}
