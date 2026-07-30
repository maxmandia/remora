const dotFieldGridSize = 9;
const dotFieldGridInset = 0.1;
const dotFieldGridStep = (1 - dotFieldGridInset * 2) / (dotFieldGridSize - 1);
const dotFieldVisibleInset = `${dotFieldGridInset * 100}%`;
const dotFieldBaseRgb = [118, 118, 118] as const;
const dotFieldHighlightRgb = [255, 255, 255] as const;

type DotFieldDot = {
  column: number;
  diagonal: number;
  id: string;
  phase: number;
  row: number;
  speed: number;
  x: number;
  y: number;
};

const dotFieldDots: DotFieldDot[] = Array.from(
  { length: dotFieldGridSize * dotFieldGridSize },
  (_, index) => {
    const row = Math.floor(index / dotFieldGridSize);
    const column = index % dotFieldGridSize;

    return {
      column,
      diagonal: (row + column) / ((dotFieldGridSize - 1) * 2),
      id: `${row}-${column}`,
      phase: index * 0.71,
      row,
      speed: 0.00048 + ((row + column) % 4) * 0.00005,
      x: dotFieldGridInset + column * dotFieldGridStep,
      y: dotFieldGridInset + row * dotFieldGridStep,
    };
  },
);

function mixDotFieldColor(intensity: number) {
  const colorIntensity = Math.min(Math.max(intensity, 0), 1);
  const [baseRed, baseGreen, baseBlue] = dotFieldBaseRgb;
  const [highlightRed, highlightGreen, highlightBlue] = dotFieldHighlightRgb;
  const red = Math.round(baseRed + (highlightRed - baseRed) * colorIntensity);
  const green = Math.round(
    baseGreen + (highlightGreen - baseGreen) * colorIntensity,
  );
  const blue = Math.round(
    baseBlue + (highlightBlue - baseBlue) * colorIntensity,
  );

  return `rgb(${red}, ${green}, ${blue})`;
}

export {
  dotFieldDots,
  dotFieldGridSize,
  dotFieldVisibleInset,
  mixDotFieldColor,
};
export type { DotFieldDot };
