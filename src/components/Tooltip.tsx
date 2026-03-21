"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconInfoCircle } from "@/components/icons";

export function Tooltip({
  text,
  label = "More info"
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={ref} className={`help-tooltip${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="help-tooltip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <IconInfoCircle size={16} />
      </button>
      {open ? (
        <span id={tooltipId} role="tooltip" className="help-tooltip-card">
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function LabelWithTooltip({
  label,
  tooltip,
  labelAria
}: {
  label: string;
  tooltip?: string | null;
  labelAria?: string;
}) {
  return (
    <span className="label-with-help">
      <span>{label}</span>
      {tooltip ? <Tooltip text={tooltip} label={labelAria || label} /> : null}
    </span>
  );
}
