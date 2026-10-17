beforeEach(() => {
  for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"])
    spyOn(lumine.shell, method).and.resolveTo();
  spyOn(lumine.application, "openWindow").and.resolveTo();
});

describe("Grammar picker editor ownership", () => {
  let editor, other, list;
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    if (lumine.packages.isPackageLoaded("grammar-selector"))
      await lumine.packages.unloadPackage("grammar-selector");
    await lumine.packages.activatePackage("grammar-selector");
    await lumine.packages.activatePackage("language-text");
    editor = await lumine.workspace.open();
    editor.setText("owned grammar target");
    other = await lumine.workspace.open(undefined, { split: "right" });
    await lumine.commands.dispatch(editor.getElement(), "grammar-selector:show");
    await conditionPromise(() =>
      lumine.workspace.getModalPanels().some((item) => item.isVisible()),
    );
    const panel = lumine.workspace.getModalPanels().find((item) => item.isVisible());
    expect(panel).toBeDefined();
    list = panel.getItem();
    await list.selectItemById("auto-detect");
  });

  afterEach(async () => {
    if (lumine.packages.isPackageLoaded("grammar-selector"))
      await lumine.packages.unloadPackage("grammar-selector");
    editor?.destroy();
    other?.destroy();
    await lumine.fileWatchClient.settlePendingTeardown();
    editor = other = list = null;
  });

  const visible = () =>
    lumine.workspace
      .getModalPanels()
      .some((panel) => panel.isVisible() && panel.getItem() === list);

  it("dismisses the picker when its original editor is destroyed", async () => {
    const buffer = editor.getBuffer();
    editor.destroy();
    expect(buffer.isDestroyed()).toBe(true);
    expect(visible()).toBe(false);
    expect(other.isDestroyed()).toBe(false);
  });

  it("assigns automatic grammar and closes for a live original editor", async () => {
    expect(visible()).toBe(true);
    await list.confirmSelection();
    expect(editor.isDestroyed()).toBe(false);
    expect(visible()).toBe(false);
    expect(lumine.grammars.getAssignedLanguageId(editor.getBuffer())).toBeUndefined();
  });

  it("applies repeated choices to its opening editor and releases it on dismissal", async () => {
    await list.runAction("select-list:toggle-keep-open");
    await list.selectItemById("text.plain");
    await list.confirmSelection();
    expect(visible()).toBe(true);
    expect(lumine.grammars.getAssignedLanguageId(editor.getBuffer())).toBe("text.plain");
    expect(list.getElement().querySelector("li.active").dataset.grammar).toBe("Plain Text");

    await list.selectItemById("auto-detect");
    await list.confirmSelection();
    expect(visible()).toBe(true);
    expect(lumine.grammars.getAssignedLanguageId(editor.getBuffer())).toBeUndefined();
    expect(lumine.grammars.getAssignedLanguageId(other.getBuffer())).toBeUndefined();
    expect(list.getElement().querySelector("li.active").dataset.grammar).toBe("Auto Detect");

    editor.destroy();
    expect(visible()).toBe(false);
  });
});
