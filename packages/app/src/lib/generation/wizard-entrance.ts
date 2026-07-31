import {
  neutralWizardMotionTarget,
  type WizardMotionTarget,
} from "./wizard-head.ts";

const wizardEntranceGravityPxPerS2 = 3000;
const wizardEntranceRestitution = 0.55;
const wizardEntranceBoxSizePx = 48;
// The wizard's visual feet (beard bottom) sit at ~115/128 of the SVG viewBox,
// so contacts are computed against this fraction of the display box.
const wizardEntranceFeetYFraction = 0.9;
const wizardEntranceSpawnMarginPx = 64;
const wizardEntranceFallDriftPx = 40;
const wizardEntranceMinFallHeightPx = 120;
const wizardEntranceApexRange = { max: 160, min: 60 };
const wizardEntranceArcClearancePx = 40;
const wizardEntranceLogoContactMs = 70;
const wizardEntranceSlotContactMs = 60;
const wizardEntranceHopHeightPx = 8;
const wizardEntranceSettleMs = 180;
const wizardEntranceMaxTiltDeg = 22;
const wizardEntranceTiltGain = 0.35;
const wizardEntranceTiltFallSpeedFloorPxPerS = 260;
const wizardEntranceStretchGain = 0.1;
const wizardEntranceStretchReferenceSpeedPxPerS = 1600;
const wizardEntranceSquashGain = 0.22;
const wizardEntranceSquashReferenceSpeedPxPerS = 1400;
// Measured from the wordmark SVG path data (viewBox 0 0 372 93): the final
// "a" spans x ≈ 340–371 with its bowl shoulder at y ≈ 24.4, so the bounce
// point holds at these fractions of the rendered image rect at any size.
const wizardEntranceWordmarkImpactXFraction = 356 / 372;
const wizardEntranceWordmarkImpactYFraction = 24.4 / 93;

type WizardEntranceRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type WizardEntranceGeometryInput = {
  logoRect: WizardEntranceRect;
  slotRect: WizardEntranceRect;
  stageRect: WizardEntranceRect;
};

type WizardEntranceGeometry = {
  bounceX: number;
  bounceY: number;
  restX: number;
  restY: number;
  spawnX: number;
  spawnY: number;
};

type WizardEntranceBallisticSegment = {
  endMs: number;
  startMs: number;
  vxPxPerS: number;
  vy0PxPerS: number;
  x0: number;
  y0: number;
};

type WizardEntranceDwellSegment = {
  endMs: number;
  startMs: number;
};

type WizardEntranceTimeline = {
  arc: WizardEntranceBallisticSegment;
  arcImpactSpeedPxPerS: number;
  arcLaunchSpeedPxPerS: number;
  durationMs: number;
  fall: WizardEntranceBallisticSegment;
  fallImpactSpeedPxPerS: number;
  geometry: WizardEntranceGeometry;
  hop: WizardEntranceBallisticSegment;
  hopImpactSpeedPxPerS: number;
  hopLaunchSpeedPxPerS: number;
  logoContact: WizardEntranceDwellSegment;
  settle: WizardEntranceDwellSegment;
  slotContact: WizardEntranceDwellSegment;
};

type WizardEntrancePhase =
  | "arc"
  | "done"
  | "fall"
  | "hop"
  | "logo-contact"
  | "settling"
  | "slot-contact";

type WizardEntranceSample = {
  feetX: number;
  feetY: number;
  horizontalVelocity: number;
  phase: WizardEntrancePhase;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
  verticalVelocity: number;
};

type WizardEntranceScales = {
  scaleX: number;
  scaleY: number;
};

function getWizardEntranceGeometry(
  input: WizardEntranceGeometryInput,
): WizardEntranceGeometry {
  const { logoRect, slotRect, stageRect } = input;
  const bounceX =
    logoRect.left -
    stageRect.left +
    logoRect.width * wizardEntranceWordmarkImpactXFraction;
  const bounceY =
    logoRect.top -
    stageRect.top +
    logoRect.height * wizardEntranceWordmarkImpactYFraction;
  const restX = slotRect.left - stageRect.left + slotRect.width / 2;
  const restY =
    slotRect.top -
    stageRect.top +
    Math.max(slotRect.height, wizardEntranceBoxSizePx) *
      wizardEntranceFeetYFraction;

  return {
    bounceX,
    bounceY,
    restX,
    restY,
    spawnX: bounceX - wizardEntranceFallDriftPx,
    spawnY: Math.min(
      -wizardEntranceSpawnMarginPx,
      bounceY - wizardEntranceMinFallHeightPx,
    ),
  };
}

function computeWizardEntranceTimeline(
  geometry: WizardEntranceGeometry,
): WizardEntranceTimeline {
  const gravity = wizardEntranceGravityPxPerS2;
  const fallHeight = Math.max(
    geometry.bounceY - geometry.spawnY,
    wizardEntranceMinFallHeightPx,
  );
  const fallDurationS = Math.sqrt((2 * fallHeight) / gravity);
  const fallVx = (geometry.bounceX - geometry.spawnX) / fallDurationS;
  const fallImpactVy = gravity * fallDurationS;
  const fallImpactSpeed = Math.hypot(fallVx, fallImpactVy);

  const slotDrop = geometry.restY - geometry.bounceY;
  const apexRise = Math.max(
    clamp(
      wizardEntranceRestitution * wizardEntranceRestitution * fallHeight,
      wizardEntranceApexRange.min,
      wizardEntranceApexRange.max,
    ),
    // The arc must always crest above the slot even when the slot sits
    // higher than the bounce point (short stages).
    -slotDrop + wizardEntranceArcClearancePx,
  );
  const arcVy0 = -Math.sqrt(2 * gravity * apexRise);
  const arcRiseS = Math.sqrt((2 * apexRise) / gravity);
  const arcFallS = Math.sqrt((2 * (apexRise + slotDrop)) / gravity);
  const arcDurationS = arcRiseS + arcFallS;
  const arcVx = (geometry.restX - geometry.bounceX) / arcDurationS;
  const arcImpactVy = gravity * arcFallS;
  const arcLaunchSpeed = Math.hypot(arcVx, arcVy0);
  const arcImpactSpeed = Math.hypot(arcVx, arcImpactVy);

  const hopVy0 = -Math.sqrt(2 * gravity * wizardEntranceHopHeightPx);
  const hopDurationS =
    2 * Math.sqrt((2 * wizardEntranceHopHeightPx) / gravity);
  const hopSpeed = Math.abs(hopVy0);

  const fallStartMs = 0;
  const fallEndMs = fallStartMs + fallDurationS * 1000;
  const logoContactEndMs = fallEndMs + wizardEntranceLogoContactMs;
  const arcEndMs = logoContactEndMs + arcDurationS * 1000;
  const slotContactEndMs = arcEndMs + wizardEntranceSlotContactMs;
  const hopEndMs = slotContactEndMs + hopDurationS * 1000;
  const settleEndMs = hopEndMs + wizardEntranceSettleMs;

  return {
    arc: {
      endMs: arcEndMs,
      startMs: logoContactEndMs,
      vxPxPerS: arcVx,
      vy0PxPerS: arcVy0,
      x0: geometry.bounceX,
      y0: geometry.bounceY,
    },
    arcImpactSpeedPxPerS: arcImpactSpeed,
    arcLaunchSpeedPxPerS: arcLaunchSpeed,
    durationMs: settleEndMs,
    fall: {
      endMs: fallEndMs,
      startMs: fallStartMs,
      vxPxPerS: fallVx,
      vy0PxPerS: 0,
      x0: geometry.spawnX,
      y0: geometry.spawnY,
    },
    fallImpactSpeedPxPerS: fallImpactSpeed,
    geometry,
    hop: {
      endMs: hopEndMs,
      startMs: slotContactEndMs,
      vxPxPerS: 0,
      vy0PxPerS: hopVy0,
      x0: geometry.restX,
      y0: geometry.restY,
    },
    hopImpactSpeedPxPerS: hopSpeed,
    hopLaunchSpeedPxPerS: hopSpeed,
    logoContact: {
      endMs: logoContactEndMs,
      startMs: fallEndMs,
    },
    settle: {
      endMs: settleEndMs,
      startMs: hopEndMs,
    },
    slotContact: {
      endMs: slotContactEndMs,
      startMs: arcEndMs,
    },
  };
}

function sampleWizardEntrance(
  timeline: WizardEntranceTimeline,
  timeMs: number,
): WizardEntranceSample {
  if (timeMs >= timeline.durationMs) {
    return {
      feetX: timeline.geometry.restX,
      feetY: timeline.geometry.restY,
      horizontalVelocity: 0,
      phase: "done",
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      verticalVelocity: 0,
    };
  }

  const t = Math.max(timeMs, 0);

  if (t < timeline.fall.endMs) {
    return sampleBallistic(timeline.fall, t, "fall");
  }

  if (t < timeline.logoContact.endMs) {
    return sampleLogoContact(timeline, t);
  }

  if (t < timeline.arc.endMs) {
    return sampleBallistic(timeline.arc, t, "arc");
  }

  if (t < timeline.slotContact.endMs) {
    return sampleSlotContact(timeline, t);
  }

  if (t < timeline.hop.endMs) {
    return sampleHop(timeline, t);
  }

  return sampleSettle(timeline, t);
}

function getWizardEntranceBoxPosition(sample: WizardEntranceSample) {
  return {
    x: sample.feetX - wizardEntranceBoxSizePx / 2,
    y: sample.feetY - wizardEntranceBoxSizePx * wizardEntranceFeetYFraction,
  };
}

function getWizardEntranceSecondaryTarget(
  sample: WizardEntranceSample,
): WizardMotionTarget {
  if (sample.phase === "fall") {
    const speed = Math.hypot(
      sample.horizontalVelocity,
      sample.verticalVelocity,
    );
    const intensity = Math.min(
      speed / wizardEntranceStretchReferenceSpeedPxPerS,
      1,
    );

    return {
      ...neutralWizardMotionTarget,
      crownY: -3.5 * intensity,
      eyesY: 0.9 * intensity,
      headY: -1 * intensity,
    };
  }

  if (sample.phase === "logo-contact" || sample.phase === "slot-contact") {
    return {
      ...neutralWizardMotionTarget,
      crownY: 2.6,
      eyesY: 0.6,
      headY: 1.2,
    };
  }

  if (sample.phase === "arc" || sample.phase === "hop") {
    const horizontalIntensity = clamp(sample.horizontalVelocity / 600, -1, 1);
    const verticalIntensity = clamp(-sample.verticalVelocity / 800, -1, 1);

    return {
      ...neutralWizardMotionTarget,
      crownRotate: -4.5 * horizontalIntensity,
      crownX: -2 * horizontalIntensity,
      crownY: 2.2 * verticalIntensity,
      eyesX: 0.65 * horizontalIntensity,
      headRotate: 2.5 * horizontalIntensity,
    };
  }

  return neutralWizardMotionTarget;
}

function sampleBallistic(
  segment: WizardEntranceBallisticSegment,
  timeMs: number,
  phase: "arc" | "fall",
): WizardEntranceSample {
  const localS = (timeMs - segment.startMs) / 1000;
  const gravity = wizardEntranceGravityPxPerS2;
  const vy = segment.vy0PxPerS + gravity * localS;
  const speed = Math.hypot(segment.vxPxPerS, vy);
  const stretch = stretchAmount(speed);

  return {
    feetX: segment.x0 + segment.vxPxPerS * localS,
    feetY: segment.y0 + segment.vy0PxPerS * localS + 0.5 * gravity * localS * localS,
    horizontalVelocity: segment.vxPxPerS,
    phase,
    rotationDeg: tiltDeg(segment.vxPxPerS, vy),
    scaleX: 1 - 0.6 * stretch,
    scaleY: 1 + stretch,
    verticalVelocity: vy,
  };
}

function sampleLogoContact(
  timeline: WizardEntranceTimeline,
  timeMs: number,
): WizardEntranceSample {
  const progress = segmentProgress(timeline.logoContact, timeMs);
  const inScales = stretchScales(timeline.fallImpactSpeedPxPerS);
  const squash = squashScales(timeline.fallImpactSpeedPxPerS);
  const outScales = stretchScales(timeline.arcLaunchSpeedPxPerS);
  const scales = contactScales(inScales, squash, outScales, progress);
  const fallEndTilt = tiltDeg(
    timeline.fall.vxPxPerS,
    wizardEntranceGravityPxPerS2 *
      ((timeline.fall.endMs - timeline.fall.startMs) / 1000),
  );
  const arcStartTilt = tiltDeg(timeline.arc.vxPxPerS, timeline.arc.vy0PxPerS);

  return {
    feetX: timeline.geometry.bounceX,
    feetY: timeline.geometry.bounceY,
    horizontalVelocity: 0,
    phase: "logo-contact",
    rotationDeg: lerp(fallEndTilt, arcStartTilt, easeInOutCubic(progress)),
    scaleX: scales.scaleX,
    scaleY: scales.scaleY,
    verticalVelocity: 0,
  };
}

function sampleSlotContact(
  timeline: WizardEntranceTimeline,
  timeMs: number,
): WizardEntranceSample {
  const progress = segmentProgress(timeline.slotContact, timeMs);
  const inScales = stretchScales(timeline.arcImpactSpeedPxPerS);
  const squash = squashScales(timeline.arcImpactSpeedPxPerS);
  const outScales = stretchScales(timeline.hopLaunchSpeedPxPerS);
  const scales = contactScales(inScales, squash, outScales, progress);

  return {
    feetX: timeline.geometry.restX,
    feetY: timeline.geometry.restY,
    horizontalVelocity: 0,
    phase: "slot-contact",
    rotationDeg: landingRotation(timeline, timeMs),
    scaleX: scales.scaleX,
    scaleY: scales.scaleY,
    verticalVelocity: 0,
  };
}

function sampleHop(
  timeline: WizardEntranceTimeline,
  timeMs: number,
): WizardEntranceSample {
  const ballistic = sampleBallistic(timeline.hop, timeMs, "arc");

  return {
    ...ballistic,
    phase: "hop",
    rotationDeg: landingRotation(timeline, timeMs),
  };
}

function sampleSettle(
  timeline: WizardEntranceTimeline,
  timeMs: number,
): WizardEntranceSample {
  const progress = segmentProgress(timeline.settle, timeMs);
  const inScales = stretchScales(timeline.hopImpactSpeedPxPerS);
  const squash = squashScales(timeline.hopImpactSpeedPxPerS);
  const squashPortion = 0.35;
  const scales =
    progress < squashPortion
      ? lerpScales(inScales, squash, easeOutCubic(progress / squashPortion))
      : lerpScales(
          squash,
          { scaleX: 1, scaleY: 1 },
          easeOutBack((progress - squashPortion) / (1 - squashPortion)),
        );

  return {
    feetX: timeline.geometry.restX,
    feetY: timeline.geometry.restY,
    horizontalVelocity: 0,
    phase: "settling",
    rotationDeg: landingRotation(timeline, timeMs),
    scaleX: scales.scaleX,
    scaleY: scales.scaleY,
    verticalVelocity: 0,
  };
}

function landingRotation(timeline: WizardEntranceTimeline, timeMs: number) {
  const arcEndVy =
    timeline.arc.vy0PxPerS +
    wizardEntranceGravityPxPerS2 *
      ((timeline.arc.endMs - timeline.arc.startMs) / 1000);
  const arcEndTilt = tiltDeg(timeline.arc.vxPxPerS, arcEndVy);
  const releaseProgress = clamp(
    (timeMs - timeline.slotContact.startMs) /
      (timeline.settle.endMs - timeline.slotContact.startMs),
    0,
    1,
  );

  return arcEndTilt * (1 - easeOutCubic(releaseProgress));
}

function contactScales(
  inScales: WizardEntranceScales,
  squash: WizardEntranceScales,
  outScales: WizardEntranceScales,
  progress: number,
): WizardEntranceScales {
  if (progress < 0.5) {
    return lerpScales(inScales, squash, easeOutCubic(progress / 0.5));
  }

  return lerpScales(squash, outScales, easeInOutCubic((progress - 0.5) / 0.5));
}

function segmentProgress(segment: WizardEntranceDwellSegment, timeMs: number) {
  return clamp(
    (timeMs - segment.startMs) / (segment.endMs - segment.startMs),
    0,
    1,
  );
}

function stretchAmount(speedPxPerS: number) {
  return (
    wizardEntranceStretchGain *
    Math.min(speedPxPerS / wizardEntranceStretchReferenceSpeedPxPerS, 1)
  );
}

function squashAmount(speedPxPerS: number) {
  return (
    wizardEntranceSquashGain *
    clamp(speedPxPerS / wizardEntranceSquashReferenceSpeedPxPerS, 0, 1)
  );
}

function stretchScales(speedPxPerS: number): WizardEntranceScales {
  const stretch = stretchAmount(speedPxPerS);

  return {
    scaleX: 1 - 0.6 * stretch,
    scaleY: 1 + stretch,
  };
}

function squashScales(speedPxPerS: number): WizardEntranceScales {
  const squash = squashAmount(speedPxPerS);

  return {
    scaleX: 1 + 0.7 * squash,
    scaleY: 1 - squash,
  };
}

function lerpScales(
  from: WizardEntranceScales,
  to: WizardEntranceScales,
  progress: number,
): WizardEntranceScales {
  return {
    scaleX: lerp(from.scaleX, to.scaleX, progress),
    scaleY: lerp(from.scaleY, to.scaleY, progress),
  };
}

function tiltDeg(vxPxPerS: number, vyPxPerS: number) {
  const tilt =
    Math.atan2(
      vxPxPerS,
      Math.max(Math.abs(vyPxPerS), wizardEntranceTiltFallSpeedFloorPxPerS),
    ) *
    (180 / Math.PI) *
    wizardEntranceTiltGain;

  return clamp(tilt, -wizardEntranceMaxTiltDeg, wizardEntranceMaxTiltDeg);
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function easeOutCubic(progress: number) {
  const inverted = 1 - progress;

  return 1 - inverted * inverted * inverted;
}

function easeInOutCubic(progress: number) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }

  const inverted = -2 * progress + 2;

  return 1 - (inverted * inverted * inverted) / 2;
}

function easeOutBack(progress: number) {
  const overshoot = 1.4;
  const inverted = progress - 1;

  return (
    1 +
    (overshoot + 1) * inverted * inverted * inverted +
    overshoot * inverted * inverted
  );
}

export {
  computeWizardEntranceTimeline,
  getWizardEntranceBoxPosition,
  getWizardEntranceGeometry,
  getWizardEntranceSecondaryTarget,
  sampleWizardEntrance,
  wizardEntranceApexRange,
  wizardEntranceBoxSizePx,
  wizardEntranceFeetYFraction,
  wizardEntranceGravityPxPerS2,
  wizardEntranceHopHeightPx,
  wizardEntranceLogoContactMs,
  wizardEntranceRestitution,
  wizardEntranceSettleMs,
  wizardEntranceSlotContactMs,
  wizardEntranceSpawnMarginPx,
  wizardEntranceWordmarkImpactXFraction,
  wizardEntranceWordmarkImpactYFraction,
};
export type {
  WizardEntranceGeometry,
  WizardEntranceGeometryInput,
  WizardEntrancePhase,
  WizardEntranceRect,
  WizardEntranceSample,
  WizardEntranceTimeline,
};
