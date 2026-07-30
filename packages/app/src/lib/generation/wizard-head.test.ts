import { describe, expect, it } from "vitest";
import {
  getWizardMotionTarget,
  neutralWizardMotionTarget,
  wizardReactionRadiusPx,
  type WizardBounds,
} from "./wizard-head.ts";

const wizardBounds: WizardBounds = {
  height: 48,
  left: 0,
  top: 0,
  width: 48,
};

describe("getWizardMotionTarget", () => {
  it("returns the neutral target at and beyond the reaction radius", () => {
    expect(
      getWizardMotionTarget(
        {
          x: wizardBounds.left + wizardBounds.width / 2,
          y:
            wizardBounds.top + wizardBounds.height / 2 + wizardReactionRadiusPx,
        },
        wizardBounds,
      ),
    ).toBe(neutralWizardMotionTarget);

    expect(getWizardMotionTarget({ x: 200, y: 200 }, wizardBounds)).toBe(
      neutralWizardMotionTarget,
    );
  });

  it("tracks the pointer direction symmetrically", () => {
    const rightTarget = getWizardMotionTarget({ x: 60, y: 24 }, wizardBounds);
    const leftTarget = getWizardMotionTarget({ x: -12, y: 24 }, wizardBounds);
    const lowerTarget = getWizardMotionTarget({ x: 24, y: 60 }, wizardBounds);

    expect(rightTarget.active).toBe(true);
    expect(rightTarget.headX).toBeCloseTo(1);
    expect(rightTarget.headRotate).toBeCloseTo(1.75);
    expect(rightTarget.crownX).toBeCloseTo(1.25);
    expect(rightTarget.eyesX).toBeCloseTo(0.325);
    expect(rightTarget.riseY).toBeCloseTo(-1.5);
    expect(leftTarget.headX).toBeCloseTo(-rightTarget.headX);
    expect(leftTarget.headRotate).toBeCloseTo(-rightTarget.headRotate);
    expect(lowerTarget.headY).toBeCloseTo(0.55);
    expect(lowerTarget.crownY).toBeCloseTo(0.725);
    expect(lowerTarget.eyesY).toBeCloseTo(0.21);
  });

  it("smoothly reduces influence near the proximity boundary", () => {
    const middleTarget = getWizardMotionTarget({ x: 60, y: 24 }, wizardBounds);
    const edgeTarget = getWizardMotionTarget({ x: 80, y: 24 }, wizardBounds);

    expect(edgeTarget.active).toBe(true);
    expect(Math.abs(edgeTarget.headX)).toBeLessThan(
      Math.abs(middleTarget.headX),
    );
    expect(Math.abs(edgeTarget.crownRotate)).toBeLessThan(
      Math.abs(middleTarget.crownRotate),
    );
  });

  it("keeps every target within its restrained motion limit", () => {
    const target = getWizardMotionTarget({ x: 48, y: 48 }, wizardBounds);

    expect(Math.abs(target.headX)).toBeLessThanOrEqual(2);
    expect(Math.abs(target.headY)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(target.headRotate)).toBeLessThanOrEqual(3.5);
    expect(Math.abs(target.crownX)).toBeLessThanOrEqual(2.5);
    expect(Math.abs(target.crownY)).toBeLessThanOrEqual(1.45);
    expect(Math.abs(target.crownRotate)).toBeLessThanOrEqual(4.75);
    expect(Math.abs(target.eyesX)).toBeLessThanOrEqual(0.65);
    expect(Math.abs(target.eyesY)).toBeLessThanOrEqual(0.42);
    expect(target.riseY).toBeGreaterThanOrEqual(-3);
    expect(target.riseY).toBeLessThanOrEqual(0);
  });

  it("rises to its maximum while internal parts center on the pointer", () => {
    const target = getWizardMotionTarget({ x: 24, y: 24 }, wizardBounds);

    expect(target).toEqual({
      ...neutralWizardMotionTarget,
      active: true,
      riseY: -3,
    });
  });

  it("rises farther as the pointer gets closer", () => {
    const farTarget = getWizardMotionTarget({ x: 84, y: 24 }, wizardBounds);
    const nearTarget = getWizardMotionTarget({ x: 48, y: 24 }, wizardBounds);

    expect(farTarget.riseY).toBeLessThan(0);
    expect(nearTarget.riseY).toBeLessThan(farTarget.riseY);
  });
});
