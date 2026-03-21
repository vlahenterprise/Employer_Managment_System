"use client";

import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconInfoCircle } from "@/components/icons";
import { getTooltipPosition } from "@/components/tooltip-position";

export function Tooltip({
  text,
  label = "More info"
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ReturnType<typeof getTooltipPosition> | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const node = buttonRef.current;
      if (!node) return;
      setPosition(
        getTooltipPosition({
          triggerRect: node.getBoundingClientRect(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        })
      );
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

    updatePosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <span ref={ref} className={`help-tooltip${open ? " is-open" : ""}`}>
      <button
        ref={buttonRef}
        type="button"
        className="help-tooltip-button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <IconInfoCircle size={16} />
      </button>
      {open && position
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className={`help-tooltip-card help-tooltip-card-${position.placement}`}
              style={
                {
                  left: `${position.left}px`,
                  top: `${position.top}px`,
                  width: `${position.width}px`,
                  "--tooltip-arrow-left": `${position.arrowLeft}px`
                } as CSSProperties
              }
            >
              {text}
            </span>,
            document.body
          )
        : null}
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
