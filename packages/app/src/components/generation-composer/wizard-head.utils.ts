const wizardReactionRadiusPx = 72;

type WizardBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type WizardPointerPosition = {
  x: number;
  y: number;
};

type WizardMotionTarget = {
  active: boolean;
  crownRotate: number;
  crownX: number;
  crownY: number;
  eyesX: number;
  eyesY: number;
  headRotate: number;
  headX: number;
  headY: number;
  riseY: number;
};

const neutralWizardMotionTarget: WizardMotionTarget = {
  active: false,
  crownRotate: 0,
  crownX: 0,
  crownY: 0,
  eyesX: 0,
  eyesY: 0,
  headRotate: 0,
  headX: 0,
  headY: 0,
  riseY: 0,
};

function getWizardMotionTarget(
  pointer: WizardPointerPosition,
  bounds: WizardBounds,
): WizardMotionTarget {
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const deltaX = pointer.x - centerX;
  const deltaY = pointer.y - centerY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance >= wizardReactionRadiusPx) {
    return neutralWizardMotionTarget;
  }

  const influenceProgress = 1 - distance / wizardReactionRadiusPx;
  const influence =
    influenceProgress * influenceProgress * (3 - 2 * influenceProgress);
  const horizontalScale = Math.max(bounds.width * 0.75, 1);
  const verticalScale = Math.max(bounds.height * 0.75, 1);
  const normalizedX = clamp(deltaX / horizontalScale, -1, 1);
  const normalizedY = clamp(deltaY / verticalScale, -1, 1);

  return {
    active: true,
    crownRotate: normalizedX * influence * 4.75,
    crownX: normalizedX * influence * 2.5,
    crownY: normalizedY * influence * 1.45,
    eyesX: normalizedX * influence * 0.65,
    eyesY: normalizedY * influence * 0.42,
    headRotate: normalizedX * influence * 3.5,
    headX: normalizedX * influence * 2,
    headY: normalizedY * influence * 1.1,
    riseY: influence * -3,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export {
  getWizardMotionTarget,
  neutralWizardMotionTarget,
  wizardReactionRadiusPx,
};
export type { WizardBounds, WizardMotionTarget, WizardPointerPosition };
