import { describe, expect, it } from "vitest";
import { neutralWizardMotionTarget } from "./wizard-head.ts";
import {
  computeWizardEntranceTimeline,
  getWizardEntranceBoxPosition,
  getWizardEntranceGeometry,
  getWizardEntranceSecondaryTarget,
  sampleWizardEntrance,
  wizardEntranceApexRange,
  wizardEntranceBoxSizePx,
  wizardEntranceFeetYFraction,
  wizardEntranceGravityPxPerS2,
  type WizardEntranceGeometryInput,
  type WizardEntranceTimeline,
} from "./wizard-entrance.ts";

const wideStageInput: WizardEntranceGeometryInput = {
  logoRect: { height: 82, left: 436, top: 282, width: 328 },
  slotRect: { height: 48, left: 1016, top: 408, width: 48 },
  stageRect: { height: 900, left: 0, top: 0, width: 1200 },
};

const narrowStageInput: WizardEntranceGeometryInput = {
  logoRect: { height: 82, left: 186, top: 132, width: 328 },
  slotRect: { height: 48, left: 612, top: 258, width: 48 },
  stageRect: { height: 600, left: 0, top: 0, width: 700 },
};

const slotAboveBounceInput: WizardEntranceGeometryInput = {
  logoRect: { height: 82, left: 436, top: 500, width: 328 },
  slotRect: { height: 48, left: 1016, top: 300, width: 48 },
  stageRect: { height: 900, left: 0, top: 0, width: 1200 },
};

const degenerateInput: WizardEntranceGeometryInput = {
  logoRect: { height: 0, left: 0, top: 0, width: 0 },
  slotRect: { height: 0, left: 0, top: 0, width: 0 },
  stageRect: { height: 0, left: 0, top: 0, width: 0 },
};

const geometryInputs = [
  wideStageInput,
  narrowStageInput,
  slotAboveBounceInput,
  degenerateInput,
];

function buildTimeline(input: WizardEntranceGeometryInput) {
  return computeWizardEntranceTimeline(getWizardEntranceGeometry(input));
}

function segmentBoundariesMs(timeline: WizardEntranceTimeline) {
  return [
    timeline.fall.endMs,
    timeline.logoContact.endMs,
    timeline.arc.endMs,
    timeline.slotContact.endMs,
    timeline.hop.endMs,
  ];
}

describe("computeWizardEntranceTimeline", () => {
  it("spawns the wizard above the stage and impacts the wordmark exactly", () => {
    const timeline = buildTimeline(wideStageInput);
    const spawnSample = sampleWizardEntrance(timeline, 0);
    const impactSample = sampleWizardEntrance(timeline, timeline.fall.endMs - 0.01);

    expect(spawnSample.phase).toBe("fall");
    expect(spawnSample.feetY).toBeLessThan(0);
    expect(impactSample.feetX).toBeCloseTo(timeline.geometry.bounceX, 1);
    expect(impactSample.feetY).toBeCloseTo(timeline.geometry.bounceY, 1);
  });

  it("bounces with a clamped restitution apex", () => {
    const timeline = buildTimeline(wideStageInput);
    const apexRise =
      (timeline.arc.vy0PxPerS * timeline.arc.vy0PxPerS) /
      (2 * wizardEntranceGravityPxPerS2);

    expect(timeline.arc.vy0PxPerS).toBeLessThan(0);
    expect(apexRise).toBeGreaterThanOrEqual(wizardEntranceApexRange.min);
    expect(apexRise).toBeLessThanOrEqual(wizardEntranceApexRange.max);
  });

  it("crests above the slot even when the slot sits higher than the bounce point", () => {
    const timeline = buildTimeline(slotAboveBounceInput);
    const apexRise =
      (timeline.arc.vy0PxPerS * timeline.arc.vy0PxPerS) /
      (2 * wizardEntranceGravityPxPerS2);
    const apexY = timeline.geometry.bounceY - apexRise;

    expect(apexY).toBeLessThan(timeline.geometry.restY);
    expect(Number.isFinite(timeline.arc.vxPxPerS)).toBe(true);
  });
});

describe("sampleWizardEntrance", () => {
  it("keeps position, scale, and rotation continuous across segment boundaries", () => {
    for (const input of geometryInputs) {
      const timeline = buildTimeline(input);

      for (const boundaryMs of segmentBoundariesMs(timeline)) {
        const before = sampleWizardEntrance(timeline, boundaryMs - 0.01);
        const after = sampleWizardEntrance(timeline, boundaryMs + 0.01);

        expect(Math.abs(after.feetX - before.feetX)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(after.feetY - before.feetY)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(after.scaleX - before.scaleX)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(after.scaleY - before.scaleY)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(after.rotationDeg - before.rotationDeg)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("lands the bounce arc exactly on the rest point for every geometry", () => {
    for (const input of geometryInputs) {
      const timeline = buildTimeline(input);
      const landingSample = sampleWizardEntrance(
        timeline,
        timeline.arc.endMs - 0.01,
      );

      expect(landingSample.feetX).toBeCloseTo(timeline.geometry.restX, 1);
      expect(landingSample.feetY).toBeCloseTo(timeline.geometry.restY, 1);
    }
  });

  it("applies consistent gravity inside every ballistic segment", () => {
    const timeline = buildTimeline(wideStageInput);
    const ballisticSegments = [timeline.fall, timeline.arc, timeline.hop];

    for (const segment of ballisticSegments) {
      const midMs = (segment.startMs + segment.endMs) / 2;
      const deltaMs = Math.min(5, (segment.endMs - segment.startMs) / 4);
      const before = sampleWizardEntrance(timeline, midMs - deltaMs);
      const after = sampleWizardEntrance(timeline, midMs + deltaMs);
      const acceleration =
        (after.verticalVelocity - before.verticalVelocity) /
        ((2 * deltaMs) / 1000);

      expect(acceleration).toBeCloseTo(wizardEntranceGravityPxPerS2, 0);
    }
  });

  it("squashes on contact, stretches in flight, and roughly conserves volume", () => {
    const timeline = buildTimeline(wideStageInput);
    const contactMidMs =
      (timeline.logoContact.startMs + timeline.logoContact.endMs) / 2;
    const fallLateMs = timeline.fall.endMs * 0.9;
    const contactSample = sampleWizardEntrance(timeline, contactMidMs);
    const fallSample = sampleWizardEntrance(timeline, fallLateMs);

    expect(contactSample.scaleY).toBeLessThan(1);
    expect(contactSample.scaleX).toBeGreaterThan(1);
    expect(fallSample.scaleY).toBeGreaterThan(1);
    expect(fallSample.scaleX).toBeLessThan(1);

    for (let timeMs = 0; timeMs <= timeline.durationMs; timeMs += 10) {
      const sample = sampleWizardEntrance(timeline, timeMs);
      const volume = sample.scaleX * sample.scaleY;

      expect(volume).toBeGreaterThanOrEqual(0.88);
      expect(volume).toBeLessThanOrEqual(1.1);
    }
  });

  it("clamps to an idempotent rest pose at and past the duration", () => {
    const timeline = buildTimeline(wideStageInput);
    const terminalSample = sampleWizardEntrance(timeline, timeline.durationMs);
    const laterSample = sampleWizardEntrance(
      timeline,
      timeline.durationMs + 5000,
    );

    expect(terminalSample).toEqual({
      feetX: timeline.geometry.restX,
      feetY: timeline.geometry.restY,
      horizontalVelocity: 0,
      phase: "done",
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      verticalVelocity: 0,
    });
    expect(laterSample).toEqual(terminalSample);
  });

  it("stays finite for degenerate geometry", () => {
    const timeline = buildTimeline(degenerateInput);

    for (let timeMs = 0; timeMs <= timeline.durationMs + 100; timeMs += 25) {
      const sample = sampleWizardEntrance(timeline, timeMs);

      for (const value of [
        sample.feetX,
        sample.feetY,
        sample.horizontalVelocity,
        sample.rotationDeg,
        sample.scaleX,
        sample.scaleY,
        sample.verticalVelocity,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("is deterministic for identical geometry", () => {
    const firstTimeline = buildTimeline(wideStageInput);
    const secondTimeline = buildTimeline(wideStageInput);

    expect(secondTimeline).toEqual(firstTimeline);

    for (const timeMs of [0, 137, 456, 789, 1200, 1500]) {
      expect(sampleWizardEntrance(secondTimeline, timeMs)).toEqual(
        sampleWizardEntrance(firstTimeline, timeMs),
      );
    }
  });
});

describe("getWizardEntranceBoxPosition", () => {
  it("offsets the feet point to the display box's top-left corner", () => {
    const timeline = buildTimeline(wideStageInput);
    const sample = sampleWizardEntrance(timeline, timeline.durationMs);
    const boxPosition = getWizardEntranceBoxPosition(sample);

    expect(boxPosition.x).toBeCloseTo(
      timeline.geometry.restX - wizardEntranceBoxSizePx / 2,
    );
    expect(boxPosition.y).toBeCloseTo(
      timeline.geometry.restY -
        wizardEntranceBoxSizePx * wizardEntranceFeetYFraction,
    );
  });
});

describe("getWizardEntranceSecondaryTarget", () => {
  it("lifts the hat during the fall and compresses it on contact", () => {
    const timeline = buildTimeline(wideStageInput);
    const fallSample = sampleWizardEntrance(timeline, timeline.fall.endMs * 0.9);
    const contactSample = sampleWizardEntrance(
      timeline,
      (timeline.logoContact.startMs + timeline.logoContact.endMs) / 2,
    );

    expect(getWizardEntranceSecondaryTarget(fallSample).crownY).toBeLessThan(0);
    expect(
      getWizardEntranceSecondaryTarget(contactSample).crownY,
    ).toBeGreaterThan(0);
  });

  it("leans the hat against rightward travel through the arc", () => {
    const timeline = buildTimeline(wideStageInput);
    const arcSample = sampleWizardEntrance(
      timeline,
      (timeline.arc.startMs + timeline.arc.endMs) / 2,
    );
    const target = getWizardEntranceSecondaryTarget(arcSample);

    expect(arcSample.horizontalVelocity).toBeGreaterThan(0);
    expect(target.crownRotate).toBeLessThan(0);
    expect(target.eyesX).toBeGreaterThan(0);
  });

  it("returns the neutral target once settled", () => {
    const timeline = buildTimeline(wideStageInput);
    const doneSample = sampleWizardEntrance(timeline, timeline.durationMs);

    expect(getWizardEntranceSecondaryTarget(doneSample)).toBe(
      neutralWizardMotionTarget,
    );
  });
});
