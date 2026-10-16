const { CompositeDisposable } = require("lumine");
const { commandEditor, itemAllowsGrammar } = require("./command-editor");

module.exports = class GrammarListView {
  constructor(window = lumine.workspace.getMainWindow()) {
    this.autoDetect = { id: "auto-detect", name: "Auto Detect" };
    this.destroyed = false;
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
            className: [
              "grammar-item",
              (this.isAutoDetect ? grammar === this.autoDetect : grammar === this.currentGrammar) &&
                "active",
              this.isAutoDetect && grammar === this.currentGrammar && "auto-selected",
            ].filter(Boolean),
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
            isAvailable: () =>
              Boolean(
                this.editor && !this.editor.isDestroyed() && itemAllowsGrammar(this.commandItem),
              ),
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
      { className: "grammar-selector", crumb: "Grammars", window },
    );
    this.selectList = this.selectListHost.getModel();
    this.disposables.add(
      this.selectListHost.onDidCancel(() => {
        this.clearEditor();
      }),
    );
  }

  destroy() {
    this.destroyed = true;
    this.clearEditor();
    this.disposables.dispose();
    return this.selectListHost.destroy();
  }

  clearEditor() {
    this.editorSubscription?.dispose();
    this.editorSubscription = null;
    this.currentGrammar = null;
    this.isAutoDetect = false;
    this.editor = null;
    this.commandItem = null;
  }

  cancel() {
    this.selectListHost.cancel();
  }

  /**
   * Keeps "Auto Detect" and the effective grammar together above the rest.
   * Only "Auto Detect" remains in this section when the effective grammar is
   * unavailable or is the null sentinel. The input array remains unchanged.
   * @param {Array} grammars - The list, already headed by "Auto Detect"
   * @returns {Array} Sections that keep the opening choices together
   */
  sectionsForCurrentGrammar(grammars) {
    const ordered = grammars.slice();
    let boundary = 1;
    const index = ordered.indexOf(this.currentGrammar);
    if (index > 0) {
      ordered.splice(index, 1);
      ordered.splice(1, 0, this.currentGrammar);
      boundary = 2;
    }
    if (boundary >= ordered.length) {
      return [{ id: "grammars", items: ordered }];
    }
    return [
      { id: "current", items: ordered.slice(0, boundary) },
      { id: "available", items: ordered.slice(boundary) },
    ];
  }

  useGrammar(grammar) {
    const editor = this.editor;
    if (!editor || editor.isDestroyed() || !itemAllowsGrammar(this.commandItem)) {
      this.cancel();
      return;
    }
    if (grammar === this.autoDetect) {
      lumine.grammars.autoAssignLanguageMode(editor.getBuffer());
    } else {
      lumine.grammars.assignGrammar(editor, grammar);
    }
    this.clearEditor();
  }

  getAllDisplayableGrammars() {
    return lumine.grammars.getGrammars().filter((grammar) => grammar.name);
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
    const { editor, item } = commandEditor(event);
    if (editor) {
      this.clearEditor();
      this.editor = editor;
      this.commandItem = item;
      this.editorSubscription = editor.onDidDestroy(() => {
        this.clearEditor();
        this.selectListHost.cancel();
      });
      this.currentGrammar = this.editor.getGrammar();
      this.isAutoDetect =
        lumine.grammars.getAssignedLanguageId(this.editor.getBuffer()) === undefined;

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
      const initialGrammar =
        this.isAutoDetect || !grammars.includes(this.currentGrammar)
          ? this.autoDetect
          : this.currentGrammar;
      await this.selectList.update({
        items: grammars,
        overflowSections: this.sectionsForCurrentGrammar(grammars),
        query: "",
        selection: {
          initial: { id: initialGrammar.id ?? initialGrammar.scopeName },
        },
      });
      if (this.destroyed || this.editor !== editor || editor.isDestroyed()) return;
      this.selectListHost.show();
    }
  }
};
