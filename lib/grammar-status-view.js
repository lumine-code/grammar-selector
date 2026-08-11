const { Disposable } = require("lumine");

module.exports = class GrammarStatusView {
  constructor(statusBar) {
    this.statusBar = statusBar;
    this.element = document.createElement("status-bar-tile");
    this.element.classList.add("grammar-status");

    this.activeItemSubscription = lumine.workspace.observeActiveTextEditor(
      this.subscribeToActiveTextEditor.bind(this),
    );

    this.configSubscription = lumine.config.observe(
      "grammar-selector.showOnRightSideOfStatusBar",
      this.attach.bind(this),
    );
    const clickHandler = (event) => {
      event.preventDefault();
      lumine.commands.dispatch(
        lumine.views.getView(lumine.workspace.getActiveTextEditor()),
        "grammar-selector:show",
      );
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

    const editor = lumine.workspace.getActiveTextEditor();
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
      const editor = lumine.workspace?.getActiveTextEditor();
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

        this.tooltip = lumine.tooltips.add(this.element, {
          title: `File uses the ${grammarName} grammar`,
        });
      } else {
        this.element.style.display = "none";
      }
    });
  }
};
