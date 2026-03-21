import test from "node:test";
import assert from "node:assert/strict";
import { getTooltipPosition } from "../src/components/tooltip-position";

test("tooltip position stays inside viewport near left edge", () => {
  const position = getTooltipPosition({
    triggerRect: {
      top: 120,
      left: 4,
      width: 20,
      height: 20,
      right: 24,
      bottom: 140
    },
    viewportWidth: 390,
    viewportHeight: 844
  });

  assert.ok(position.left >= 16);
  assert.ok(position.arrowLeft >= 20);
  assert.equal(position.placement, "bottom");
});

test("tooltip position stays inside viewport near right edge", () => {
  const position = getTooltipPosition({
    triggerRect: {
      top: 240,
      left: 360,
      width: 24,
      height: 20,
      right: 384,
      bottom: 260
    },
    viewportWidth: 390,
    viewportHeight: 844
  });

  assert.ok(position.left + position.width <= 390 - 16);
  assert.ok(position.arrowLeft <= position.width - 20);
});

test("tooltip flips above when there is not enough space below", () => {
  const position = getTooltipPosition({
    triggerRect: {
      top: 720,
      left: 180,
      width: 24,
      height: 20,
      right: 204,
      bottom: 740
    },
    viewportWidth: 430,
    viewportHeight: 760
  });

  assert.equal(position.placement, "top");
  assert.ok(position.top < 720);
});

test("tooltip helper is stable across 100 rapid calculations", () => {
  const results = Array.from({ length: 100 }, (_, index) =>
    getTooltipPosition({
      triggerRect: {
        top: 80 + index,
        left: 24 + index,
        width: 20,
        height: 20,
        right: 44 + index,
        bottom: 100 + index
      },
      viewportWidth: 1280,
      viewportHeight: 900
    })
  );

  assert.equal(results.length, 100);
  assert.ok(results.every((result) => result.left >= 16));
  assert.ok(results.every((result) => result.width >= 220));
});
