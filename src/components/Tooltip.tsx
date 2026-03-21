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
  const [align, setAlign] = useState<"left" | "center" | "right">("right");
  const ref = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    const updateAlignment = () => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const tooltipWidth = Math.min(280, window.innerWidth - 48);
      const viewportPadding = 18;
      const centerLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
      const centerRight = centerLeft + tooltipWidth;

      if (rect.left + tooltipWidth > window.innerWidth - viewportPadding) {
        setAlign("right");
        return;
      }

      if (centerLeft >= viewportPadding && centerRight <= window.innerWidth - viewportPadding) {
        setAlign("center");
        return;
      }

      setAlign("left");
    };

    const onPointerDown = (event: MouseEvent) => {
      const node = ref.current;
      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    updateAlignment();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateAlignment);
    window.addEventListener("scroll", updateAlignment, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateAlignment);
      window.removeEventListener("scroll", updateAlignment, true);
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
        <span id={tooltipId} role="tooltip" className={`help-tooltip-card help-tooltip-card-${align}`}>
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
