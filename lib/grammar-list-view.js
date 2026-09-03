const { CompositeDisposable } = require("lumine");

module.exports = class GrammarListView {
  constructor() {
    this.autoDetect = { id: "auto-detect", name: "Auto Detect" };
    this.disposables = new CompositeDisposable();

    this.selectListHost = lumine.workspace.addSelectList(
      {
        itemsClassList: ["mark-active"],
        items: [],
        getItemId: (grammar) => grammar.id ?? grammar.scopeName,
        search: { getFilterText: (grammar) => grammar.name },
        renderItem: (grammar, { highlight }) => {
          const grammarName = grammar.name || grammar.scopeName;
          return {
            className: ["grammar-item", grammar === this.currentGrammar && "active"].filter(
              Boolean,
            ),
            primary: highlight(grammarName),
            trailing: grammar.scopeName
              ? [{ text: grammar.scopeName, className: "badge badge-info" }]
              : [],
            didRender: (element) => {
              element.dataset.grammar = grammarName;
            },
          };
        },
        commands: {
          "grammar-selector:use-selected-grammar": {
            description: "Use the selected grammar for the current editor.",
            didDispatch: (event) => this.useGrammar(event.detail.item),
          },
        },
        actions: [
          {
            command: "grammar-selector:use-selected-grammar",
            context: "item",
            primary: true,
            disposition: "close",
          },
        ],
      },
      { className: "grammar-selector", crumb: "Grammars" },
    );
    this.selectList = this.selectListHost.getModel();
    this.disposables.add(
      this.selectListHost.onDidCancel(() => {
        this.currentGrammar = null;
        this.editor = null;
      }),
    );
  }

  destroy() {
    this.currentGrammar = null;
    this.editor = null;
    this.disposables.dispose();
    return this.selectListHost.destroy();
  }

  cancel() {
    this.selectListHost.cancel();
  }

  /**
   * Moves the editor's current grammar directly under "Auto Detect", so the
   * head of the list is the two rows the picker was opened over: what the
   * file is set to now, and the way back to no override. Mutates `grammars`.
   *
   * Nothing moves when the current grammar is the "Auto Detect" placeholder —
   * it is already the first row — or when it is not in the list at all, which
   * happens when it has been removed since the list was built. The input array
   * remains unchanged.
   * @param {Array} grammars - The list, already headed by "Auto Detect"
   * @returns {Array} Sections that keep the opening choices together
   */
  sectionsForCurrentGrammar(grammars) {
    const ordered = grammars.slice();
    let boundary = -1;
    if (this.currentGrammar === this.autoDetect) {
      boundary = 1;
    } else {
      const index = ordered.indexOf(this.currentGrammar);
      if (index > 0) {
        ordered.splice(index, 1);
        ordered.splice(1, 0, this.currentGrammar);
        boundary = 2;
      }
    }
    if (boundary <= 0 || boundary >= ordered.length) {
      return [{ id: "grammars", items: ordered }];
    }
    return [
      { id: "current", items: ordered.slice(0, boundary) },
      { id: "available", items: ordered.slice(boundary) },
    ];
  }

  useGrammar(grammar) {
    if (grammar === this.autoDetect) {
      lumine.textEditors.clearGrammarOverride(this.editor);
    } else {
      lumine.grammars.assignGrammar(this.editor, grammar);
    }
    this.currentGrammar = null;
    this.editor = null;
  }

  getAllDisplayableGrammars() {
    let allGrammars = lumine.grammars.getGrammars().filter((grammar) => {
      return grammar !== lumine.grammars.nullGrammar && grammar.name;
    });

    return allGrammars;
  }

  async toggle(event) {
    if (this.selectListHost.isVisible()) {
      this.cancel();
      return;
    }

    // Resolved from the dispatch target first: an embedded editor — a notebook
    // cell, an inline result — is a real `lumine-text-editor` that is never the
    // active pane item, so the keybinding and the context menu reach it while
    // `getActiveTextEditor()` cannot. The fallback resolves through the active
    // item too, so the menu bar works from a notebook in command mode.
    const editor =
      lumine.textEditors.getTextEditorForElement(event?.target, { includeMini: false }) ??
      lumine.workspace.getActiveEmbeddedTextEditor();
    if (editor) {
      this.editor = editor;
      this.currentGrammar = this.editor.getGrammar();
      if (this.currentGrammar === lumine.grammars.nullGrammar) {
        this.currentGrammar = this.autoDetect;
      }

      let grammars = this.getAllDisplayableGrammars();

      grammars.sort((a, b) => {
        if (a.scopeName === "text.plain") {
          return -1;
        } else if (b.scopeName === "text.plain") {
          return 1;
        } else {
          return (
            a.name.localeCompare(b.name) || (a.scopeName || "").localeCompare(b.scopeName || "")
          );
        }
      });

      grammars.unshift(this.autoDetect);
      await this.selectList.update({
        sections: this.sectionsForCurrentGrammar(grammars),
      });
      this.selectListHost.show();
    }
  }
};
