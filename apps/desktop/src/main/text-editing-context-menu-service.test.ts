import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BrowserWindow,
  ContextMenuParams,
  MenuItemConstructorOptions,
} from "electron";

const electronMocks = vi.hoisted(() => ({
  Menu: {
    buildFromTemplate: vi.fn(),
  },
}));

vi.mock("electron", () => electronMocks);

import { setupTextEditingContextMenu } from "./text-editing-context-menu-service.ts";

describe("setupTextEditingContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spelling suggestions and replaces the misspelled word", () => {
    const harness = createHarness();

    expect(harness.window.webContents.on).toHaveBeenCalledWith(
      "context-menu",
      expect.any(Function),
    );

    harness.showContextMenu({
      dictionarySuggestions: ["the", "tech"],
      misspelledWord: "teh",
    });

    const template = harness.getMenuTemplate();
    const suggestion = getMenuItem(template, { label: "the" });

    suggestion.click?.({} as never, harness.window, {} as never);

    expect(harness.window.webContents.replaceMisspelling).toHaveBeenCalledWith(
      "the",
    );
    expect(harness.popup).toHaveBeenCalledWith({ window: harness.window });
  });

  it("adds the misspelled word to the spellchecker dictionary", () => {
    const harness = createHarness();

    harness.showContextMenu({ misspelledWord: "Remora" });

    const addToDictionary = getMenuItem(harness.getMenuTemplate(), {
      label: "Add to Dictionary",
    });

    addToDictionary.click?.({} as never, harness.window, {} as never);

    expect(
      harness.window.webContents.session.addWordToSpellCheckerDictionary,
    ).toHaveBeenCalledWith("Remora");
  });

  it("shows a disabled fallback when there are no spelling suggestions", () => {
    const harness = createHarness();

    harness.showContextMenu({
      dictionarySuggestions: [],
      misspelledWord: "Remoraa",
    });

    expect(
      getMenuItem(harness.getMenuTemplate(), { label: "No Guesses Found" }),
    ).toMatchObject({ enabled: false });
  });

  it("uses the renderer edit flags for standard editing actions", () => {
    const harness = createHarness();

    harness.showContextMenu({
      editFlags: {
        canCopy: true,
        canCut: false,
        canDelete: true,
        canEditRichly: false,
        canPaste: false,
        canRedo: true,
        canSelectAll: false,
        canUndo: true,
      },
    });

    const template = harness.getMenuTemplate();

    expect(getMenuItem(template, { role: "undo" }).enabled).toBe(true);
    expect(getMenuItem(template, { role: "redo" }).enabled).toBe(true);
    expect(getMenuItem(template, { role: "cut" }).enabled).toBe(false);
    expect(getMenuItem(template, { role: "copy" }).enabled).toBe(true);
    expect(getMenuItem(template, { role: "paste" }).enabled).toBe(false);
    expect(getMenuItem(template, { role: "delete" }).enabled).toBe(true);
    expect(getMenuItem(template, { role: "selectAll" }).enabled).toBe(false);
  });

  it("shows editing actions without spelling actions for correctly spelled text", () => {
    const harness = createHarness();

    harness.showContextMenu();

    const template = harness.getMenuTemplate();

    expect(template.map((item) => item.role).filter(Boolean)).toEqual([
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "delete",
      "selectAll",
    ]);
    expect(template.some((item) => item.label === "Add to Dictionary")).toBe(
      false,
    );
    expect(harness.popup).toHaveBeenCalledWith({ window: harness.window });
  });

  it("ignores context menus outside editable fields", () => {
    const harness = createHarness();

    harness.showContextMenu({ isEditable: false });

    expect(electronMocks.Menu.buildFromTemplate).not.toHaveBeenCalled();
    expect(harness.popup).not.toHaveBeenCalled();
  });
});

function createHarness() {
  let contextMenuHandler:
    | ((event: unknown, params: ContextMenuParams) => void)
    | undefined;
  const popup = vi.fn();
  const window = {
    webContents: {
      on: vi.fn((event, handler) => {
        if (event === "context-menu") {
          contextMenuHandler = handler;
        }
      }),
      replaceMisspelling: vi.fn(),
      session: {
        addWordToSpellCheckerDictionary: vi.fn(),
      },
    },
  } as unknown as BrowserWindow;

  electronMocks.Menu.buildFromTemplate.mockReturnValue({ popup });
  setupTextEditingContextMenu(window);

  return {
    popup,
    window,
    getMenuTemplate() {
      const template = electronMocks.Menu.buildFromTemplate.mock.lastCall?.[0];

      if (!template) {
        throw new Error("Text editing menu was not built");
      }

      return template as MenuItemConstructorOptions[];
    },
    showContextMenu(overrides: Partial<ContextMenuParams> = {}) {
      if (!contextMenuHandler) {
        throw new Error("Context menu handler was not registered");
      }

      contextMenuHandler({}, createContextMenuParams(overrides));
    },
  };
}

function createContextMenuParams(
  overrides: Partial<ContextMenuParams>,
): ContextMenuParams {
  return {
    dictionarySuggestions: [],
    editFlags: {
      canCopy: true,
      canCut: true,
      canDelete: true,
      canEditRichly: false,
      canPaste: true,
      canRedo: true,
      canSelectAll: true,
      canUndo: true,
    },
    isEditable: true,
    misspelledWord: "",
    ...overrides,
  } as ContextMenuParams;
}

function getMenuItem(
  template: MenuItemConstructorOptions[],
  selector: Pick<MenuItemConstructorOptions, "label" | "role">,
) {
  const item = template.find(
    (candidate) =>
      (selector.label && candidate.label === selector.label) ||
      (selector.role && candidate.role === selector.role),
  );

  if (!item) {
    throw new Error("Expected text editing menu item was not found");
  }

  return item;
}
