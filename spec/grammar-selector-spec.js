const path = require("path");

describe("GrammarSelector", () => {
  let [editor, textGrammar, jsGrammar] = [];

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", false);

    await lumine.packages.activatePackage("status-bar");
    await lumine.packages.activatePackage("grammar-selector");
    await lumine.packages.activatePackage("language-log");
    await lumine.packages.activatePackage("language-javascript");

    editor = await lumine.workspace.open(path.join(__dirname, "fixtures", "sample.js"));

    textGrammar = lumine.grammars.grammarForScopeName("text.plain");
    expect(textGrammar).toBeTruthy();
    jsGrammar = lumine.grammars.grammarForScopeName("source.js");
    expect(jsGrammar).toBeTruthy();
    expect(editor.getGrammar()).toBe(jsGrammar);
  });

  describe("when grammar-selector:show is triggered", () =>
    it("displays a list of all the available grammars", async () => {
      const grammars = lumine.grammars.getGrammars();
      spyOn(lumine.grammars, "getGrammars").and.returnValue([
        ...grammars,
        { scopeName: "source.unnamed-injection", type: "tree-sitter", fileTypes: [] },
      ]);
      const grammarView = (await getGrammarView(editor)).getElement();

      let allGrammars = lumine.grammars.getGrammars().filter((g) => g.name);

      // -1 for removing nullGrammar, +1 for adding "Auto Detect"
      expect(grammarView.querySelectorAll("li:not(.select-list-separator)").length).toBe(
        allGrammars.length,
      );
      expect(grammarView.querySelectorAll("li:not(.select-list-separator)")[0].textContent).toBe(
        "Auto Detect",
      );
      expect(grammarView.textContent).not.toContain("source.unnamed-injection");
      grammarView
        .querySelectorAll("li:not(.select-list-separator)")
        .forEach((li) => expect(li.textContent).not.toBe(lumine.grammars.nullGrammar.name));
    }));

  describe("when the query matches a grammar", () =>
    it("marks the matched characters in the rendered row", async () => {
      const view = await getGrammarView(editor);
      view.getQueryEditor().setText("jav");
      await lumine.views.getNextUpdatePromise();

      const matched = view.getElement().querySelectorAll("li .character-match");
      expect(matched.length).toBeGreaterThan(0);
      // The row highlights the grammar name it is showing, not the raw query.
      expect(Array.from(matched).every((span) => "JavaScript".includes(span.textContent))).toBe(
        true,
      );
    }));

  describe("when a grammar is selected", () =>
    it("sets the new grammar on the editor", async () => {
      const grammarView = await getGrammarView(editor);
      await grammarView.selectItemById(textGrammar.scopeName);
      await grammarView.confirmSelection();
      expect(editor.getGrammar()).toBe(textGrammar);
    }));

  describe("when auto-detect is selected", () => {
    it("restores the auto-detected grammar on the editor", async () => {
      let grammarView = await getGrammarView(editor);
      await grammarView.selectItemById(textGrammar.scopeName);
      await grammarView.confirmSelection();
      expect(editor.getGrammar()).toBe(textGrammar);
      grammarView = await getGrammarView(editor);
      await grammarView.selectItemById("auto-detect");
      await grammarView.confirmSelection();
      let currentGrammar = editor.getGrammar();
      expect(currentGrammar.scopeName).toBe("source.js");
      expect(currentGrammar.constructor.name).toBe("TreeSitterGrammar");
    });
  });

  describe("when the editor's current grammar is the null grammar", () => {
    it("displays Auto Detect as the selected grammar", async () => {
      editor.setGrammar(lumine.grammars.nullGrammar);
      const grammarView = (await getGrammarView(editor)).getElement();
      expect(grammarView.querySelector("li.active").textContent).toBe("Auto Detect");
    });

    it("rules off directly under Auto Detect, with nothing to hoist above it", async () => {
      editor.setGrammar(lumine.grammars.nullGrammar);
      const grammarView = (await getGrammarView(editor)).getElement();

      const separator = grammarView.querySelector(".select-list-separator");
      expect(separator.previousElementSibling.textContent).toBe("Auto Detect");
    });
  });

  describe("the current grammar's place in the list", () => {
    it("sits directly under Auto Detect, with a rule below it", async () => {
      const view = await getGrammarView(editor);
      const displayedItems = view.getDisplayedItems();

      expect(displayedItems[0].name).toBe("Auto Detect");
      expect(displayedItems[1]).toBe(editor.getGrammar());

      const separator = view.getElement().querySelector(".select-list-separator");
      expect(separator.previousElementSibling.dataset.grammar).toBe(editor.getGrammar().name);
      expect(separator.previousElementSibling.classList.contains("active")).toBe(true);
    });

    it("drops the rule once a query ranks the rows instead", async () => {
      const view = await getGrammarView(editor);
      view.getQueryEditor().setText("jav");
      await lumine.views.getNextUpdatePromise();

      expect(view.getElement().querySelector(".select-list-separator")).toBeNull();
    });
  });

  describe("when editor is untitled", () =>
    it("sets the new grammar on the editor", async () => {
      editor = await lumine.workspace.open();
      expect(editor.getGrammar()).not.toBe(jsGrammar);

      const grammarView = await getGrammarView(editor);
      await grammarView.selectItemById(jsGrammar.scopeName);
      await grammarView.confirmSelection();
      expect(editor.getGrammar()).toBe(jsGrammar);
    }));

  describe("when dispatched from an embedded editor that is not the active pane item", () =>
    it("targets the editor hosting the dispatch, not the active pane item", async () => {
      // A notebook cell's editor is a real `lumine-text-editor` living inside
      // another pane item, so the active text editor is never the one asked.
      const embedded = lumine.workspace.buildTextEditor({ autoHeight: true });
      const registration = lumine.textEditors.add(embedded);
      const element = embedded.getElement();
      lumine.views.getView(lumine.workspace).appendChild(element);

      try {
        expect(lumine.workspace.getActiveTextEditor()).toBe(editor);
        const activeGrammarBefore = editor.getGrammar();

        const grammarView = await getGrammarView(embedded);
        await grammarView.selectItemById(textGrammar.scopeName);
        await grammarView.confirmSelection();

        expect(embedded.getGrammar()).toBe(textGrammar);
        expect(editor.getGrammar()).toBe(activeGrammarBefore);
      } finally {
        registration.dispose();
        element.remove();
        embedded.destroy();
      }
    }));

  describe("Status bar grammar label", () => {
    let [grammarStatus, grammarTile, statusBar] = [];

    beforeEach(async () => {
      statusBar = document.querySelector("status-bar");
      grammarTile = statusBar
        .getLeftTiles()
        .find((tile) => tile.getItem()?.classList?.contains("grammar-status"));
      grammarStatus = grammarTile.getItem();

      // Wait for status bar service hook to fire
      while (!grammarStatus || !grammarStatus.textContent) {
        await lumine.views.getNextUpdatePromise();
        grammarStatus = document.querySelector(".grammar-status");
      }
    });

    it("displays the name of the current grammar", () => {
      expect(grammarStatus.textContent).toBe("JavaScript");
      expect(getTooltipText(grammarStatus)).toBe("Uses the JavaScript grammar");
      expect(getTooltipKeyBinding(grammarStatus)).toBe(
        process.platform === "darwin" ? "⌃⇧L" : "Ctrl+Shift+L",
      );
    });

    it("displays the embedded editor's grammar for an item that reports one", async () => {
      // The shape a notebook has: not a text editor itself, but naming the
      // active cell's editor through the workspace's item protocol.
      const embedded = lumine.workspace.buildTextEditor({ autoHeight: true });
      embedded.setGrammar(textGrammar);
      const item = document.createElement("div");
      item.getTitle = () => "Embedded Host";
      item.getActiveEmbeddedTextEditor = () => embedded;
      item.onDidChangeActiveTextEditors = () => ({ dispose() {} });

      try {
        lumine.workspace.getCenter().getActivePane().activateItem(item);
        await lumine.views.getNextUpdatePromise();

        expect(lumine.workspace.getActiveTextEditor()).toBeUndefined();
        expect(grammarStatus.textContent).toBe("Plain Text");
        expect(grammarStatus.style.display).toBe("");
      } finally {
        lumine.workspace.getCenter().getActivePane().activateItem(editor);
        await lumine.views.getNextUpdatePromise();
        embedded.destroy();
      }
    });

    it("displays Plain Text when the current grammar is the null grammar", async () => {
      editor.setGrammar(lumine.grammars.nullGrammar);
      await lumine.views.getNextUpdatePromise();

      expect(grammarStatus.textContent).toBe("Plain Text");
      expect(grammarStatus).toBeVisible();
      expect(getTooltipText(grammarStatus)).toBe("Uses the Plain Text grammar");

      editor.setGrammar(lumine.grammars.grammarForScopeName("source.js"));
      await lumine.views.getNextUpdatePromise();

      expect(grammarStatus.textContent).toBe("JavaScript");
      expect(grammarStatus).toBeVisible();
    });

    it("hides the label when the current grammar is null", async () => {
      jasmine.attachToDOM(editor.getElement());
      spyOn(editor, "getGrammar").and.returnValue(null);
      editor.setGrammar(lumine.grammars.nullGrammar);
      await lumine.views.getNextUpdatePromise();
      expect(grammarStatus.offsetHeight).toBe(0);
    });

    describe("when the grammar-selector.showOnRightSideOfStatusBar setting changes", () =>
      it("moves the item to the preferred side of the status bar", () => {
        expect(statusBar.getLeftTiles().map((tile) => tile.getItem())).toContain(grammarStatus);
        expect(statusBar.getRightTiles().map((tile) => tile.getItem())).not.toContain(
          grammarStatus,
        );

        lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", true);

        expect(statusBar.getLeftTiles().map((tile) => tile.getItem())).not.toContain(grammarStatus);
        expect(statusBar.getRightTiles().map((tile) => tile.getItem())).toContain(grammarStatus);

        lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", false);

        expect(statusBar.getLeftTiles().map((tile) => tile.getItem())).toContain(grammarStatus);
        expect(statusBar.getRightTiles().map((tile) => tile.getItem())).not.toContain(
          grammarStatus,
        );
      }));

    describe("when the editor's grammar changes", () =>
      it("displays the new grammar of the editor", async () => {
        editor.setGrammar(lumine.grammars.grammarForScopeName("text.plain"));
        await lumine.views.getNextUpdatePromise();

        expect(grammarStatus.textContent).toBe("Plain Text");
        expect(getTooltipText(grammarStatus)).toBe("Uses the Plain Text grammar");
      }));

    describe("when clicked", () =>
      it("shows the grammar selector modal", () => {
        const eventHandler = jasmine.createSpy("eventHandler");
        lumine.commands.add(editor.getElement(), "grammar-selector:show", eventHandler);
        grammarStatus.click();
        expect(eventHandler).toHaveBeenCalled();
      }));

    describe("when the package is deactivated", () => {
      it("removes the view", () => {
        spyOn(grammarTile, "destroy");
        lumine.packages.deactivatePackage("grammar-selector");
        expect(grammarTile.destroy).toHaveBeenCalled();
      });

      it("cancels a pending label update", async () => {
        const updateSubscription = jasmine.createSpyObj("update subscription", ["dispose"]);
        spyOn(lumine.views, "updateDocument").and.returnValue(updateSubscription);

        editor.setGrammar(lumine.grammars.nullGrammar);
        await lumine.packages.deactivatePackage("grammar-selector");

        expect(updateSubscription.dispose).toHaveBeenCalled();
      });
    });
  });
});

function getTooltipText(element) {
  const tooltipElement = getTooltipElement(element);
  tooltipElement.querySelector(".key-bindings")?.remove();
  return tooltipElement.textContent.trim();
}

function getTooltipKeyBinding(element) {
  return getTooltipElement(element).querySelector(".keystroke")?.textContent;
}

function getTooltipElement(element) {
  const [tooltip] = lumine.tooltips.findTooltips(element);
  const tooltipElement = document.createElement("div");
  tooltipElement.innerHTML = tooltip.getTitle();
  return tooltipElement;
}

async function getGrammarView(editor) {
  let timeout = setTimeout(() => {
    throw new Error("Timeout");
  }, 5000);
  lumine.commands.dispatch(editor.getElement(), "grammar-selector:show");
  await lumine.views.getNextUpdatePromise();
  clearTimeout(timeout);
  return lumine.workspace.getModalPanels()[0].getItem();
}
