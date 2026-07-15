import { useEffect, useRef, type PointerEvent } from "react";

const cursorReactionRadiusScale = 0.5;
const cursorReactionStrengthScale = 0.06175;
const driftScale = 0.65;
const reducedMotionReactionScale = 0.65;
const fallbackBoundsPx = 100;

const remoraAsciiRows = String.raw`
                               ..........................
                       ........:----::::----:::::::::---:....
               ...:...:--::::::::-----:::------------:--:::--::..    ..
      .........:---::::---------:::-----:::------:::::::-==--::-:. ..::...
 ......::--::---------:-------:-----::----::::-----::--===-:---:::::-----:::
::----::----------------:-----------:::-----:::::----=---:-=-::..------==-::
-=====--:::--------------:::------::--::::::::---=----::-=-::....:::-====-..
-----==--:::------:--------:::::::::::::--==------::::-=-::....::--====-:...
---:---==--::::::::::::::::::------==-----::::::::--==-::....::--===---:
:----::::-:::::-------=---------------:-:-======+++=--:...:::--==--==:..
::--------------------:--------====+**++++**##++==--:.:::----======--:
------::::::::-----====+*######*****####*+**++++---:::--=====++++==...
:::-------===++++**##%%%%*+=======-=++++=========---=++**#####*==..
---===+****####%%%%%%#*++--==+**++==-----------==++*##%%%%%#*==..
+**####%%%%%%###*++++==-:--+*-.:.-*+-:::----==+*#%%%%%%%#*+=-..
#%%%%%%%###****++==----::=+-......::=-::==+*#%%%%%%%##*+==-..
#####***++++======-----::-=: ....:++--::*#%%%@%%####+=-....
****++=======--==------::::--=+===+=--+*%%%%%%##*+==-..
+++==========----------------====---**%%%%##**++-:...
-==--====----------====++***********%%%%##*+==::.
-=-----------====+++*##%%%@@@@@@@%%%%#**+=-:::.
====-----====++**##%%@@@@@@@%%%%##**++-:::
======+++***##%%%%%@@@@%%%%%%##*++--::
=+++*###%%%%%@@@%%%%%%%%###**+=-::
===**##%%%%%%%%%%%%%###**++-:::.
+==-=++++************++=--:.
##*========----------::.
####***++==----------.
`
  .slice(1)
  .trimEnd()
  .split("\n");

const remoraAsciiColorRows = [
  "                               NNNNNNNNNNNNNNNNNNNNNNNNNN",
  "                       NNNNNNNNNBBBBBBNBBBBBBBBBBBBBBBBBNNNNN",
  "               NNNNNNNNBBBBBBBNBBBBBBBBBBBBBBBBBBBBBBBBBBNBBBBNNN    NN",
  "      NNNNNNNNNBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN NNBBNNN",
  " NNNNNNNNBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNNBBBBBBBNN",
  "NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNNNBBBBBBBBBBBBGBBNNNBBBBBBBBBNN",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBNBGBNNNNNNBBBBBBBBBNN",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBNBBBBBNBBBBBBBBBBBBBBBBNNNBGBBNNNNNNBBBBBBBBNNNN",
  "BBBBBBBBBBBBBBBBBNNNNNNBBBBBBBBBBBBBBBBBBBBBBBBNBBBGGGBBNNNNNNBBBBBBBBGN",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBGGGGGGMMMGGBNNNNNNBBBBBBBGGNNN",
  "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBGGGGMMMMMMMMMSSMMGGGBNNNNBBBBBGGGGGGGGN",
  "BBBBBBBBBBBBBBBBBBBGGGGMMSSSSSSMMMMMSSSSMMMMMMMMGGBBBBBGGGGGGMMMMGGNNN",
  "NNBBBBBGGGGGGMMMMMMSSSSSSMMGGGGGGGGGMMMMGGGGGGGGGGGGGMMMMSSSSSMGGNN",
  "GGGGGGMMMMSSSSSSSHHHHSSMMGGGGMMMMMGGGGGGGGGGGGGGGMMMSSSHHHSSMGGNN",
  "MMMSSSSSSSSHHSSSMMMMMGGGNEEEEEEEEEEEEEENGGGGGMMMSHHHHHHSSMMGGNN",
  "SHHHHHHSSSSMMMMMMGGGGGGNBEEEEEEEEEEEEEENGGMMSSHHHHSSSSMMGGGNN",
  "SSSSSMMMMMMMMGGGGGGGGGGNBEEE EEEEEEEEEEBMSSHHHHHSSSSMGGNNNN",
  "MMMMMMMGGGGGGGGGGGGGGGGGNGGGGGMMGGMGGGMMHHHHHSSSMMMGGNN",
  "MMMGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGMMHHHHSSMMMMGNNNN",
  "GGGGGGGGGGGGGGGGGGGGGGGMMMMMMMMMMMMMHHHHSSMMGGGNN",
  "GGGGGGGGGGGGGGGGGMMMMSSSHHSSSSSSSHHHSSMMMGGNNNN",
  "GGGGGGGGGGGGGMMMMSSHHSSSSSSSHHHHSSMMMMGGNN",
  "GGGGGGMMMMMSSSSHHHHSSSSHHHHHSSSMMMGGNN",
  "GMMMMSSSSHHHHSSSHHHHHHHSSSSMMMGGNN",
  "GGMMMSSSSHHHHHHHHHSSSSSMMMMGNNNN",
  "MGGGGMMMMMMMMMMMMMMMMMMGGGGN",
  "SSMGGGGGGGGGGGGBBBBGGNNN",
  "SSSSMMMMMGGGBBBBBBBGGN",
];

const remoraAsciiPalette = {
  B: "#c4c0ba",
  E: "#65635f",
  G: "#9a999f",
  H: "#e1ddd7",
  M: "#bdb8ae",
  N: "#777570",
  S: "#d2cdc4",
} as const;

type RemoraAsciiSymbol = {
  color: string;
  id: string;
  index: number;
  phase: number;
  speed: number;
  value: string;
};

type RemoraAsciiCell = RemoraAsciiSymbol | string;

type RemoraAsciiGeometry = {
  height: number;
  positions: Array<{ x: number; y: number }>;
  width: number;
};

type PointerState = {
  active: boolean;
  x: number;
  y: number;
};

const { cellRows: remoraAsciiCellRows, symbols: remoraAsciiSymbols } =
  createRemoraAsciiGrid();

export function RemoraAsciiArt() {
  const rootRef = useRef<HTMLPreElement | null>(null);
  const symbolRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pointerRef = useRef<PointerState>({ active: false, x: 0, y: 0 });
  const geometryRef = useRef<RemoraAsciiGeometry | null>(null);
  const geometryDirtyRef = useRef(true);
  const activeSymbolIndicesRef = useRef<Set<number>>(new Set());
  const reducedMotionRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const startAnimationRef = useRef(() => {});
  const resetAnimationRef = useRef(() => {});

  useEffect(() => {
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    function syncReducedMotion() {
      reducedMotionRef.current = Boolean(motionQuery?.matches);
      startAnimationRef.current();
    }

    syncReducedMotion();
    motionQuery?.addEventListener("change", syncReducedMotion);

    return () => {
      motionQuery?.removeEventListener("change", syncReducedMotion);
    };
  }, []);

  useEffect(() => {
    function stopAnimation() {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    function resetSymbols() {
      activeSymbolIndicesRef.current.forEach((index) => {
        const element = symbolRefs.current[index];

        if (element) {
          element.style.transform = "";
        }
      });
      activeSymbolIndicesRef.current.clear();
    }

    function measureGeometry() {
      const root = rootRef.current;

      if (!root) {
        return null;
      }

      const rootBounds = root.getBoundingClientRect();
      const positions = remoraAsciiSymbols.map((symbol) => {
        const symbolBounds =
          symbolRefs.current[symbol.index]?.getBoundingClientRect();

        return {
          x: symbolBounds
            ? symbolBounds.left - rootBounds.left + symbolBounds.width / 2
            : 0,
          y: symbolBounds
            ? symbolBounds.top - rootBounds.top + symbolBounds.height / 2
            : 0,
        };
      });
      const geometry = {
        height: rootBounds.height || fallbackBoundsPx,
        positions,
        width: rootBounds.width || fallbackBoundsPx,
      };

      geometryRef.current = geometry;
      geometryDirtyRef.current = false;

      return geometry;
    }

    function draw(time: number) {
      animationFrameRef.current = null;

      if (!pointerRef.current.active) {
        return;
      }

      const geometry = geometryDirtyRef.current
        ? measureGeometry()
        : geometryRef.current;

      if (!geometry) {
        return;
      }

      const pointer = pointerRef.current;
      const isReducedMotion = reducedMotionRef.current;
      const size = Math.min(geometry.width, geometry.height);
      const reactionRadius = size * cursorReactionRadiusScale;
      const reactionStrength =
        size *
        cursorReactionStrengthScale *
        (isReducedMotion ? reducedMotionReactionScale : 1);
      const nextActiveSymbolIndices = new Set<number>();

      remoraAsciiSymbols.forEach((symbol) => {
        const position = geometry.positions[symbol.index];
        const element = symbolRefs.current[symbol.index];

        if (!position || !element) {
          return;
        }

        const deltaX = position.x - pointer.x;
        const deltaY = position.y - pointer.y;
        const distance = Math.max(Math.hypot(deltaX, deltaY), 0.001);

        if (distance >= reactionRadius) {
          return;
        }

        const falloff = (1 - distance / reactionRadius) ** 2;
        const localDriftScale = isReducedMotion ? 0 : driftScale * falloff;
        const driftX =
          (Math.sin(time * symbol.speed + symbol.phase) * 2.6 +
            Math.sin(time * symbol.speed * 0.53 + symbol.phase * 1.7) * 1.1) *
          localDriftScale;
        const driftY =
          (Math.cos(time * symbol.speed * 0.86 + symbol.phase) * 2.2 +
            Math.sin(time * symbol.speed * 0.41 + symbol.phase * 0.8) * 0.9) *
          localDriftScale;
        const reactionX = (deltaX / distance) * reactionStrength * falloff;
        const reactionY = (deltaY / distance) * reactionStrength * falloff;

        element.style.transform = `translate(${(driftX + reactionX).toFixed(
          3,
        )}px, ${(driftY + reactionY).toFixed(3)}px)`;
        nextActiveSymbolIndices.add(symbol.index);
      });

      activeSymbolIndicesRef.current.forEach((index) => {
        if (nextActiveSymbolIndices.has(index)) {
          return;
        }

        const element = symbolRefs.current[index];

        if (element) {
          element.style.transform = "";
        }
      });
      activeSymbolIndicesRef.current = nextActiveSymbolIndices;

      if (!isReducedMotion) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    }

    function startAnimation() {
      if (pointerRef.current.active && animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    }

    function resetAnimation() {
      pointerRef.current.active = false;
      stopAnimation();
      resetSymbols();
    }

    startAnimationRef.current = startAnimation;
    resetAnimationRef.current = resetAnimation;

    return () => {
      startAnimationRef.current = () => {};
      resetAnimationRef.current = () => {};
      stopAnimation();
      resetSymbols();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const Observer = window.ResizeObserver;

    if (!root || !Observer) {
      return;
    }

    const observer = new Observer(() => {
      geometryDirtyRef.current = true;
      startAnimationRef.current();
    });

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, []);

  function updatePointer(event: PointerEvent<HTMLPreElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();

    pointerRef.current.active = true;
    pointerRef.current.x = event.clientX - bounds.left;
    pointerRef.current.y = event.clientY - bounds.top;
    startAnimationRef.current();
  }

  function handlePointerEnter(event: PointerEvent<HTMLPreElement>) {
    geometryDirtyRef.current = true;
    updatePointer(event);
  }

  function handlePointerEnd(event: PointerEvent<HTMLPreElement>) {
    if (event.pointerType === "touch") {
      return;
    }

    resetAnimationRef.current();
  }

  function handleMouseLeave() {
    resetAnimationRef.current();
  }

  return (
    <figure
      className="w-full max-w-[min(100%,68rem)] overflow-hidden select-none"
      aria-label="ASCII art of the Remora fish mascot"
    >
      <pre
        ref={rootRef}
        aria-label="ASCII art of the Remora fish mascot"
        className="mx-auto w-max max-w-full text-left font-mono text-[0.22rem] leading-[0.9] tracking-[0] lg:text-[0.275rem]"
        onMouseLeave={handleMouseLeave}
        onPointerCancel={handlePointerEnd}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerEnd}
        onPointerMove={updatePointer}
        role="img"
      >
        {remoraAsciiCellRows.map((cells, rowIndex) => (
          <span key={rowIndex} className="block">
            {cells.map((cell) => {
              if (typeof cell === "string") {
                return cell;
              }

              return (
                <span
                  key={cell.id}
                  ref={(element) => {
                    symbolRefs.current[cell.index] = element;
                  }}
                  aria-hidden="true"
                  className="pointer-events-none inline-block"
                  data-slot="remora-ascii-symbol"
                  style={{ color: cell.color }}
                >
                  {cell.value}
                </span>
              );
            })}
          </span>
        ))}
      </pre>
    </figure>
  );
}

function createRemoraAsciiGrid() {
  const symbols: RemoraAsciiSymbol[] = [];
  const cellRows = remoraAsciiRows.map<RemoraAsciiCell[]>((line, row) =>
    Array.from(line, (value, column) => {
      if (value === " ") {
        return value;
      }

      const index = symbols.length;
      const symbol = {
        color: getRemoraAsciiColor(remoraAsciiColorRows[row]?.[column]),
        id: `${row}-${column}`,
        index,
        phase: index * 0.71,
        speed: 0.00048 + ((row + column) % 4) * 0.00005,
        value,
      };

      symbols.push(symbol);

      return symbol;
    }),
  );

  return { cellRows, symbols };
}

function getRemoraAsciiColor(code: string | undefined) {
  if (code && code in remoraAsciiPalette) {
    return remoraAsciiPalette[code as keyof typeof remoraAsciiPalette];
  }

  return remoraAsciiPalette.N;
}
