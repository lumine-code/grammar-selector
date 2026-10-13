describe("grammar-selector status action menu", () => {
  let editor;
  const tile = () => lumine.workspace.getElement().querySelector(".grammar-status");
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("status-bar");
    await lumine.packages.activatePackage("grammar-selector");
    editor = await lumine.workspace.open();
    editor.setText("first\nsecond\n");
    await conditionPromise(() => tile() && tile().style.display !== "none");
    await lumine.views.getNextUpdatePromise();
  });
  afterEach(async () => {
    await lumine.workspace.discardEditorWindows();
    await lumine.packages.deactivatePackage("grammar-selector");
  });

  it("shows the editor's owned shortcut in the menu and its HTML row", async () => {
    const element = tile();
    const menu = lumine.contextMenu.templateForElement(element);
    const label = process.platform === "darwin" ? "⌃⇧L" : "Ctrl+Shift+L";
    expect(menu[0].keyBindingLabel).toBe(label);
    const popup = lumine.contextMenu.show(element, menu);
    try {
      expect(popup.element.querySelector(".menu-item-keystroke").textContent).toBe(label);
    } finally {
      popup.close();
    }
    await lumine.workspace.open({
      getTitle: () => "Preview",
      element: document.createElement("div"),
    });
    expect(lumine.contextMenu.templateForElement(element)[0].keyBindingLabel).toBe("");
  });

  it("looks up shortcuts in the tile's window rather than the main editor", async () => {
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    const other = lumine.workspace.buildTextEditor();
    other.getElement().setAttribute("data-menu-owner", "remote");
    extra.getEditorContainer().getActivePane().activateItem(other, { activatePane: true });
    const keys = lumine.keymaps.add(
      "grammar-status-owner-spec",
      {
        'lumine-text-editor[data-menu-owner="remote"]': { "ctrl-alt-1": "grammar-selector:show" },
      },
      100,
    );
    try {
      const remote = extra.getElement().querySelector(".grammar-status");
      expect(lumine.contextMenu.templateForElement(remote)[0].keyBindingLabel).toBe(
        process.platform === "darwin" ? "⌃⌥1" : "Ctrl+Alt+1",
      );
      expect(lumine.contextMenu.templateForElement(tile())[0].keyBindingLabel).toBe(
        process.platform === "darwin" ? "⌃⇧L" : "Ctrl+Shift+L",
      );
    } finally {
      keys.dispose();
    }
  });

  it("offers the primary mouse action and ignores right button clicks", () => {
    const element = tile();
    expect(element.hasAttribute("data-context-menu-boundary")).toBe(true);
    const commands = lumine.contextMenu.templateForElement(element).map((item) => item.command);
    expect(commands).toContain("grammar-selector:show");
    const [tooltip] = lumine.tooltips.findTooltips(element);
    expect(tooltip.getTitle()).toContain("Click to");
    expect(tooltip.getTitle()).not.toContain("tooltip-composite");
    const dispatch = spyOn(lumine.commands, "dispatch");
    element.dispatchEvent(new MouseEvent("click", { button: 2, bubbles: true }));
    lumine.contextMenu.templateForElement(element);
    expect(dispatch).not.toHaveBeenCalled();
    element.click();
    expect(dispatch).toHaveBeenCalledOnceWith(element, "grammar-selector:show");
  });

  it("retires the tile click handler and its menu on deactivation", async () => {
    const element = tile();
    await lumine.packages.deactivatePackage("grammar-selector");
    const dispatch = spyOn(lumine.commands, "dispatch");
    element.click();
    expect(dispatch).not.toHaveBeenCalled();
    expect(
      lumine.contextMenu.templateForElement(element).map((item) => item.command),
    ).not.toContain("grammar-selector:show");
  });
});
