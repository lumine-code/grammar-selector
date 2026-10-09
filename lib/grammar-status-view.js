const { Disposable } = require("lumine");

module.exports = class GrammarStatusView {
  constructor(statusBar) {
    this.statusBar = statusBar;
    this.element = document.createElement("status-bar-tile");
    this.element.classList.add("grammar-status");

    try {
      this.initialize();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  initialize() {
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
    if (this.destroyed) return;
    this.attachRequested = true;
    if (this.attaching) return;
    this.attaching = true;
    try {
      while (this.attachRequested && !this.destroyed) {
        this.attachRequested = false;
        const previous = this.tile;
        this.tile = null;
        previous?.destroy();
        if (this.destroyed) break;

        // Retire a staged tile before attaching this same element elsewhere.
        const rightSide = lumine.config.get("grammar-selector.showOnRightSideOfStatusBar");
        const tile = rightSide
          ? this.statusBar.addRightTile({ item: this.element, priority: 410 })
          : this.statusBar.addLeftTile({ item: this.element, priority: 320 });
        if (
          this.destroyed ||
          this.attachRequested ||
          rightSide !== lumine.config.get("grammar-selector.showOnRightSideOfStatusBar")
        ) {
          this.attachRequested = !this.destroyed;
          tile.destroy();
        } else this.tile = tile;
      }
    } finally {
      this.attaching = false;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
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
    if (this.destroyed) return;
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
    if (this.destroyed) return;
    if (this.updateSubscription) {
      this.updateSubscription.dispose();
    }

    this.updateSubscription = lumine.views.updateDocument(() => {
      this.updateSubscription = null;
      if (this.destroyed) return;
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
