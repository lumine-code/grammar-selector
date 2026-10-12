describe("grammar-selector presentation contexts", () => {
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("status-bar");
    await lumine.packages.activatePackage("grammar-selector");
  });
  afterEach(async () => {
    await lumine.workspace.discardEditorWindows();
  });
  it("keeps simultaneous pickers beside their invoking editors", async () => {
    const workspace = lumine.workspace;
    const main = workspace.getMainWindow();
    const editor = await workspace.open();
    const extra = await workspace.openEditorWindow({ show: false });
    const copy = editor.copy();
    extra.getEditorContainer().getActivePane().activateItem(copy, { activatePane: true });
    await lumine.commands.dispatch(main.getElement(), "grammar-selector:show");
    await conditionPromise(() => main.getElement().querySelector(".grammar-selector"));
    await lumine.commands.dispatch(extra.getElement(), "grammar-selector:show");
    await conditionPromise(() => extra.getElement().querySelector(".grammar-selector"));
    expect(main.getElement().querySelector(".grammar-selector")).not.toBeNull();
    expect(extra.getElement().querySelector(".grammar-selector").ownerDocument).toBe(
      extra.getDocument(),
    );
  });
});
