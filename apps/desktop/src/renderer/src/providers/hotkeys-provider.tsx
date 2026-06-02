import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  getHotkeyDefinition,
  type HotkeyCommandId,
  type HotkeyCombo,
  type HotkeyDefinition,
} from "../lib/hotkey-registry.ts";

type HotkeyModifiers = {
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
};

export type HotkeyOptions = {
  enabled?: boolean;
  allowRepeat?: boolean;
  allowInEditable?: boolean;
  preventDefault?: boolean;
  onKeyDown: (event: KeyboardEvent) => void | Promise<void>;
};

type HotkeyRegistration = HotkeyOptions & {
  commandId: HotkeyCommandId;
};

type HotkeyRegistrationRef = {
  current: HotkeyRegistration;
};

type HotkeysContextValue = {
  registerHotkey: (registrationRef: HotkeyRegistrationRef) => () => void;
};

const HotkeysContext = createContext<HotkeysContextValue | null>(null);

export function HotkeysProvider({ children }: { children: ReactNode }) {
  const commandRegistrationsRef = useRef(
    new Map<HotkeyCommandId, HotkeyRegistrationRef>(),
  );
  const comboRegistrationsRef = useRef(
    new Map<HotkeyCombo, HotkeyRegistrationRef>(),
  );

  const registerHotkey = useCallback((registrationRef: HotkeyRegistrationRef) => {
    const { commandId } = registrationRef.current;
    const definition = getHotkeyDefinition(commandId);
    const existingCommandRegistration =
      commandRegistrationsRef.current.get(commandId);

    if (existingCommandRegistration && existingCommandRegistration !== registrationRef) {
      throw new Error(`Hotkey command "${commandId}" is already active.`);
    }

    const existingComboRegistration = comboRegistrationsRef.current.get(
      definition.combo,
    );

    if (existingComboRegistration && existingComboRegistration !== registrationRef) {
      const existingCommandId = existingComboRegistration.current.commandId;

      throw new Error(
        `Hotkey combo "${definition.combo}" is already active for "${existingCommandId}".`,
      );
    }

    commandRegistrationsRef.current.set(commandId, registrationRef);
    comboRegistrationsRef.current.set(definition.combo, registrationRef);

    return () => {
      if (commandRegistrationsRef.current.get(commandId) === registrationRef) {
        commandRegistrationsRef.current.delete(commandId);
      }

      if (
        comboRegistrationsRef.current.get(definition.combo) === registrationRef
      ) {
        comboRegistrationsRef.current.delete(definition.combo);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }

      const registrations = Array.from(
        commandRegistrationsRef.current.values(),
      ).reverse();

      for (const registrationRef of registrations) {
        const registration = registrationRef.current;
        const definition = getHotkeyDefinition(registration.commandId);

        if (!shouldHandleHotkey(event, registration, definition)) {
          continue;
        }

        if (registration.preventDefault ?? true) {
          event.preventDefault();
        }

        void registration.onKeyDown(event);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const value = useMemo(
    () => ({
      registerHotkey,
    }),
    [registerHotkey],
  );

  return (
    <HotkeysContext.Provider value={value}>{children}</HotkeysContext.Provider>
  );
}

export function useHotkey(commandId: HotkeyCommandId, options: HotkeyOptions) {
  const context = useContext(HotkeysContext);
  const registrationRef = useRef<HotkeyRegistration>({
    commandId,
    ...options,
  });
  const registerHotkey = context?.registerHotkey;
  registrationRef.current = {
    commandId,
    ...options,
  };

  useEffect(
    () => registerHotkey?.(registrationRef),
    [commandId, registerHotkey],
  );

  if (!context) {
    throw new Error("Hotkeys must be registered inside HotkeysProvider.");
  }
}

function shouldHandleHotkey(
  event: KeyboardEvent,
  registration: HotkeyRegistration,
  definition: HotkeyDefinition,
) {
  if (registration.enabled === false) {
    return false;
  }

  if (event.repeat && !registration.allowRepeat) {
    return false;
  }

  if (!registration.allowInEditable && isEditableTarget(event)) {
    return false;
  }

  return matchesCombo(event, definition.combo);
}

function matchesCombo(event: KeyboardEvent, combo: HotkeyCombo) {
  const { key, modifiers } = parseHotkeyCombo(combo);

  return matchesKey(event, key) && matchesModifiers(event, modifiers);
}

function parseHotkeyCombo(combo: HotkeyCombo) {
  const parts = combo.split("+");
  const key = parts[parts.length - 1] ?? "";
  const modifiers = new Set(parts.slice(0, -1));

  return {
    key,
    modifiers: {
      mod: modifiers.has("Mod"),
      ctrl: modifiers.has("Ctrl"),
      meta: modifiers.has("Meta"),
      alt: modifiers.has("Alt"),
      shift: modifiers.has("Shift"),
    },
  };
}

function matchesKey(event: KeyboardEvent, key: string) {
  return normalizeKey(event.key) === normalizeKey(key);
}

function normalizeKey(key: string) {
  const normalized = key === " " ? key : key.trim().toLowerCase();

  if (normalized === "esc") {
    return "escape";
  }

  if (normalized === "space") {
    return " ";
  }

  return normalized;
}

function matchesModifiers(event: KeyboardEvent, modifiers: HotkeyModifiers) {
  const expectsMod = modifiers.mod ?? false;
  const isApple = isApplePlatform();
  const expectsMeta = (modifiers.meta ?? false) || (expectsMod && isApple);
  const expectsCtrl = (modifiers.ctrl ?? false) || (expectsMod && !isApple);
  const expectsShift = modifiers.shift ?? false;
  const expectsAlt = modifiers.alt ?? false;

  return (
    event.metaKey === expectsMeta &&
    event.ctrlKey === expectsCtrl &&
    event.shiftKey === expectsShift &&
    event.altKey === expectsAlt
  );
}

function isApplePlatform() {
  return /\b(Mac|iPhone|iPad|iPod)\b/.test(navigator.platform);
}

function isEditableTarget(event: KeyboardEvent) {
  const target = getEventTarget(event);

  if (!target) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])',
    ),
  );
}

function getEventTarget(event: KeyboardEvent) {
  const [target] = event.composedPath();

  if (target instanceof Element) {
    return target;
  }

  return event.target instanceof Element ? event.target : null;
}
