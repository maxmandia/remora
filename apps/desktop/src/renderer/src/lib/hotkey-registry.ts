export type HotkeyModifier = "Mod" | "Ctrl" | "Meta" | "Alt" | "Shift";

type Letter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type NamedKey =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "Backspace"
  | "Delete"
  | "Enter"
  | "Escape"
  | "Space"
  | "Tab";

type FunctionKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12";

export type HotkeyKey = Letter | Digit | NamedKey | FunctionKey;

type ModifierPrefix =
  | "Mod"
  | "Mod+Alt"
  | "Mod+Alt+Shift"
  | "Mod+Shift"
  | "Ctrl"
  | "Ctrl+Alt"
  | "Ctrl+Alt+Shift"
  | "Ctrl+Shift"
  | "Meta"
  | "Meta+Alt"
  | "Meta+Alt+Shift"
  | "Meta+Shift"
  | "Alt"
  | "Alt+Shift"
  | "Shift";

export type HotkeyCombo = HotkeyKey | `${ModifierPrefix}+${HotkeyKey}`;

export type HotkeyDefinition = {
  allowSharedCombo?: true;
  id: string;
  combo: HotkeyCombo;
};

type DuplicateValue<
  Items extends readonly HotkeyDefinition[],
  Field extends keyof HotkeyDefinition,
  Seen = never,
> = Items extends readonly [
  infer Head extends HotkeyDefinition,
  ...infer Tail extends readonly HotkeyDefinition[],
]
  ? Head[Field] extends Seen
    ? Head[Field]
    : DuplicateValue<Tail, Field, Seen | Head[Field]>
  : never;

type UniqueHotkeyDefinitions<Items extends readonly HotkeyDefinition[]> = [
  DuplicateValue<Items, "id">,
] extends [never]
  ? unknown
  : {
      readonly __duplicateHotkeyId: DuplicateValue<Items, "id">;
    };

export function defineHotkeys<
  const Definitions extends readonly HotkeyDefinition[],
>(definitions: Definitions & UniqueHotkeyDefinitions<Definitions>) {
  assertUniqueHotkeys(definitions);

  return definitions;
}

export const hotkeyDefinitions = defineHotkeys([
  {
    id: "auth.requestSignIn",
    combo: "S",
  },
  {
    id: "app.toggleSidebar",
    combo: "Meta+B",
  },
  {
    id: "app.newGeneration",
    combo: "Meta+N",
  },
  {
    id: "app.createProject",
    combo: "Meta+P",
  },
  {
    allowSharedCombo: true,
    id: "generation.closeStackPanel",
    combo: "Escape",
  },
  {
    allowSharedCombo: true,
    id: "generation.closeVideoPlayback",
    combo: "Escape",
  },
] as const);

export type HotkeyCommandId = (typeof hotkeyDefinitions)[number]["id"];

const hotkeyDefinitionsById = new Map<HotkeyCommandId, HotkeyDefinition>(
  hotkeyDefinitions.map((definition) => [definition.id, definition]),
);

export function getHotkeyDefinition(commandId: HotkeyCommandId) {
  const definition = hotkeyDefinitionsById.get(commandId);

  if (!definition) {
    throw new Error(`Hotkey command "${commandId}" is not registered.`);
  }

  return definition;
}

export function getHotkeyDisplayParts(combo: HotkeyCombo) {
  return combo.split("+").map(formatHotkeyDisplayPart);
}

function formatHotkeyDisplayPart(part: string) {
  switch (part) {
    case "ArrowDown":
      return "Down";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "Mod":
      return isApplePlatform() ? "Cmd" : "Ctrl";
    case "Meta":
      return "Cmd";
    default:
      return part;
  }
}

function isApplePlatform() {
  return /\b(Mac|iPhone|iPad|iPod)\b/.test(navigator.platform);
}

function assertUniqueHotkeys(definitions: readonly HotkeyDefinition[]) {
  const ids = new Map<string, HotkeyDefinition>();
  const combos = new Map<string, HotkeyDefinition[]>();

  for (const definition of definitions) {
    const existingId = ids.get(definition.id);

    if (existingId) {
      throw new Error(
        `Hotkey command "${definition.id}" is already registered for "${existingId.combo}".`,
      );
    }

    const existingComboDefinitions = combos.get(definition.combo);

    if (
      existingComboDefinitions &&
      !existingComboDefinitions.every(
        (existingDefinition) => existingDefinition.allowSharedCombo,
      )
    ) {
      const existingDefinition = existingComboDefinitions[0]!;

      throw new Error(
        `Hotkey combo "${definition.combo}" is already registered for "${existingDefinition.id}".`,
      );
    }

    if (existingComboDefinitions && !definition.allowSharedCombo) {
      const existingDefinition = existingComboDefinitions[0]!;

      throw new Error(
        `Hotkey combo "${definition.combo}" is already registered for "${existingDefinition.id}".`,
      );
    }

    ids.set(definition.id, definition);
    combos.set(definition.combo, [
      ...(existingComboDefinitions ?? []),
      definition,
    ]);
  }
}
