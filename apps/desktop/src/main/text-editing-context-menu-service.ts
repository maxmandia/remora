import {
  Menu,
  type BrowserWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
} from "electron";

export function setupTextEditingContextMenu(window: BrowserWindow) {
  window.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable) {
      return;
    }

    const menu = Menu.buildFromTemplate(
      createTextEditingMenuTemplate(window, params),
    );

    menu.popup({ window });
  });
}

function createTextEditingMenuTemplate(
  window: BrowserWindow,
  params: ContextMenuParams,
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  if (params.misspelledWord) {
    if (params.dictionarySuggestions.length > 0) {
      template.push(
        ...params.dictionarySuggestions.map((suggestion) => ({
          label: suggestion,
          click: () => window.webContents.replaceMisspelling(suggestion),
        })),
      );
    } else {
      template.push({
        label: "No Guesses Found",
        enabled: false,
      });
    }

    template.push(
      { type: "separator" },
      {
        label: "Add to Dictionary",
        click: () =>
          window.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord,
          ),
      },
      { type: "separator" },
    );
  }

  template.push(
    { role: "undo", enabled: params.editFlags.canUndo },
    { role: "redo", enabled: params.editFlags.canRedo },
    { type: "separator" },
    { role: "cut", enabled: params.editFlags.canCut },
    { role: "copy", enabled: params.editFlags.canCopy },
    { role: "paste", enabled: params.editFlags.canPaste },
    { role: "delete", enabled: params.editFlags.canDelete },
    { type: "separator" },
    { role: "selectAll", enabled: params.editFlags.canSelectAll },
  );

  return template;
}
