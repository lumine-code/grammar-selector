const { Disposable } = require("lumine");

module.exports = class GrammarStatusView {
  constructor(statusBar) {
    this.statusBar = statusBar;
    this.element = document.createElement("status-bar-tile");
    this.element.classList.add("grammar-status");

    // The embedded resolution, not the plain active editor: the grammar is a
    // property of what is being edited, so inside a notebook the tile names
    // the active cell's grammar.
    this.activeItemSubscription = lumine.workspace.observeActiveEmbeddedTextEditor(
      this.subscribeToActiveTextEditor.bind(this),
    );

    this.configSubscription = lumine.config.observe(
      "grammar-selector.showOnRightSideOfStatusBar",
      this.attach.bind(this),
    );
    const clickHandler = (event) => {
      event.preventDefault();
      const editor = lumine.workspace.getActiveEmbeddedTextEditor();
      if (!editor) return;
      // Dispatched at the editor's own element, so the picker resolves the
      // same editor from its dispatch target.
      lumine.commands.dispatch(lumine.views.getView(editor), "grammar-selector:show");
    };
    this.element.addEventListener("click", clickHandler);
    this.clickSubscription = new Disposable(() => {
      this.element.removeEventListener("click", clickHandler);
    });
  }

  attach() {
    if (this.tile) {
      this.tile.destroy();
    }

    // File-identity band on either side, see packages/status-bar/README.md.
    this.tile = lumine.config.get("grammar-selector.showOnRightSideOfStatusBar")
      ? this.statusBar.addRightTile({ item: this.element, priority: 410 })
      : this.statusBar.addLeftTile({ item: this.element, priority: 320 });
  }

  destroy() {
    if (this.activeItemSubscription) {
      this.activeItemSubscription.dispose();
    }

    if (this.grammarSubscription) {
      this.grammarSubscription.dispose();
    }

    if (this.clickSubscription) {
      this.clickSubscription.dispose();
    }

    if (this.configSubscription) {
      this.configSubscription.dispose();
    }

    if (this.updateSubscription) {
      this.updateSubscription.dispose();
      this.updateSubscription = null;
    }

    if (this.tile) {
      this.tile.destroy();
    }

    if (this.tooltip) {
      this.tooltip.dispose();
    }
  }

  subscribeToActiveTextEditor() {
    if (this.grammarSubscription) {
      this.grammarSubscription.dispose();
      this.grammarSubscription = null;
    }

    const editor = lumine.workspace.getActiveEmbeddedTextEditor();
    if (editor) {
      this.grammarSubscription = editor.onDidChangeGrammar(this.updateGrammarText.bind(this));
    }
    this.updateGrammarText();
  }

  updateGrammarText() {
    if (this.updateSubscription) {
      this.updateSubscription.dispose();
    }

    this.updateSubscription = lumine.views.updateDocument(() => {
      this.updateSubscription = null;
      const editor = lumine.workspace?.getActiveEmbeddedTextEditor();
      const grammar = editor ? editor.getGrammar() : null;

      if (this.tooltip) {
        this.tooltip.dispose();
        this.tooltip = null;
      }

      if (grammar) {
        const grammarName =
          grammar === lumine.grammars.nullGrammar
            ? "Plain Text"
            : grammar.name || grammar.scopeName;

        this.element.textContent = grammarName;
        this.element.dataset.grammar = grammarName;
        this.element.style.display = "";

        // "Uses", not "File uses": inside a notebook the tile describes the
        // active cell, not the file.
        this.tooltip = lumine.tooltips.add(this.element, {
          title: `Uses the ${grammarName} grammar`,
          keyBindingCommand: "grammar-selector:show",
          keyBindingTarget: lumine.views.getView(editor),
        });
      } else {
        this.element.style.display = "none";
      }
    });
  }
};
