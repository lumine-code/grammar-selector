module.exports = class GrammarListView {
  constructor() {
    this.autoDetect = { name: "Auto Detect" };

    this.selectListView = lumine.workspace.buildSelectList({
      className: "grammar-selector",
      crumb: "Grammars",
      itemsClassList: ["mark-active"],
      items: [],
      filterKeyForItem: (grammar) => grammar.name,
      // Null under a query: the rows are ranked by score there, and a line
      // drawn in that would mean nothing.
      idForItem: (grammar) => (this.selectListView.getQuery() === "" ? grammar : null),
      elementForItem: (grammar, { highlight }) => {
        const grammarName = grammar.name || grammar.scopeName;
        const element = document.createElement("li");
        if (grammar === this.currentGrammar) {
          element.classList.add("active");
        }
        element.classList.add("grammar-item");
        element.appendChild(highlight(grammarName));
        element.dataset.grammar = grammarName;

        const div = document.createElement("div");
        div.classList.add("pull-right");

        if (grammar.scopeName) {
          const scopeName = document.createElement("span");
          scopeName.classList.add("badge", "badge-info");
          scopeName.textContent = grammar.scopeName;
          div.appendChild(scopeName);
        }

        if (div.childElementCount > 0) {
          element.appendChild(div);
        }

        return element;
      },
      didConfirmSelection: (grammar) => {
        this.cancel();
        if (grammar === this.autoDetect) {
          lumine.textEditors.clearGrammarOverride(this.editor);
        } else {
          lumine.grammars.assignGrammar(this.editor, grammar);
        }
      },
      didCancelSelection: () => {
        this.cancel();
      },
    });
  }

  destroy() {
    this.cancel();
    return this.selectListView.destroy();
  }

  cancel() {
    this.currentGrammar = null;
    this.selectListView.hide();
  }

  /**
   * Moves the editor's current grammar directly under "Auto Detect", so the
   * head of the list is the two rows the picker was opened over: what the
   * file is set to now, and the way back to no override. Mutates `grammars`.
   *
   * Nothing moves when the current grammar is the "Auto Detect" placeholder —
   * it is already the first row — or when it is not in the list at all, which
   * happens when it has been removed since the list was built.
   * @param {Array} grammars - The list, already headed by "Auto Detect"
   * @returns {Array} `separatorIds` naming the row the rule goes above
   */
  hoistCurrentGrammar(grammars) {
    let boundary = -1;
    if (this.currentGrammar === this.autoDetect) {
      boundary = 1;
    } else {
      const index = grammars.indexOf(this.currentGrammar);
      if (index > 0) {
        grammars.splice(index, 1);
        grammars.splice(1, 0, this.currentGrammar);
        boundary = 2;
      }
    }
    return boundary > 0 && boundary < grammars.length ? [grammars[boundary]] : [];
  }

  getAllDisplayableGrammars() {
    let allGrammars = lumine.grammars.getGrammars().filter((grammar) => {
      return grammar !== lumine.grammars.nullGrammar && grammar.name;
    });

    return allGrammars;
  }

  async toggle(event) {
    if (this.selectListView.isVisible()) {
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
      await this.selectListView.update({
        items: grammars,
        separatorIds: this.hoistCurrentGrammar(grammars),
      });
      this.selectListView.show();
    }
  }
};
