export type TooltipPlacement = "top" | "bottom";

export type TooltipRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type TooltipPosition = {
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  placement: TooltipPlacement;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getTooltipPosition(params: {
  triggerRect: TooltipRect;
  viewportWidth: number;
  viewportHeight: number;
  preferredWidth?: number;
  preferredHeight?: number;
  margin?: number;
  offset?: number;
}): TooltipPosition {
  const {
    triggerRect,
    viewportWidth,
    viewportHeight,
    preferredWidth = 320,
    preferredHeight = 116,
    margin = 16,
    offset = 12
  } = params;

  const width = clamp(preferredWidth, 220, Math.max(220, viewportWidth - margin * 2));
  const triggerCenter = triggerRect.left + triggerRect.width / 2;
  const maxLeft = Math.max(margin, viewportWidth - margin - width);
  const left = clamp(triggerCenter - width / 2, margin, maxLeft);
  const arrowLeft = clamp(triggerCenter - left, 20, width - 20);
  const canPlaceAbove = triggerRect.top >= preferredHeight + margin + offset;
  const shouldPlaceAbove = triggerRect.bottom + preferredHeight + offset > viewportHeight - margin && canPlaceAbove;

  return {
    left,
    width,
    arrowLeft,
    placement: shouldPlaceAbove ? "top" : "bottom",
    top: shouldPlaceAbove ? triggerRect.top - offset : triggerRect.bottom + offset
  };
}
