describe("Grammar Selector command availability", () => {
  let fragment, item, activeFragment;
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("grammar-selector");
  });
  afterEach(async () => {
    await lumine.packages.deactivatePackage("grammar-selector");
    if (item) await lumine.workspace.paneForItem(item)?.destroyItem(item);
    fragment?.destroy();
    item = fragment = null;
  });
  it("declines an empty workspace without constructing or listing grammars", () => {
    spyOn(lumine.grammars, "getGrammars").and.callThrough();
    expect(
      lumine.commands.canDispatch(lumine.workspace.getElement(), "grammar-selector:show"),
    ).toBe(false);
    expect(lumine.grammars.getGrammars).not.toHaveBeenCalled();
  });
  it("honors the composite item's inactive fragment protocol even for a direct dormant editor target", () => {
    fragment = lumine.workspace.buildTextEditor();
    const element = document.createElement("div");
    element.appendChild(fragment.element);
    activeFragment = null;
    item = {
      element,
      getTitle: () => "Composite",
      getActiveEmbeddedTextEditor: () => activeFragment,
    };
    lumine.workspace.getCenter().getActivePane().activateItem(item);
    expect(lumine.workspace.resolveCommandContext(fragment.element).embeddedEditor).toBe(fragment);
    expect(lumine.commands.canDispatch(fragment.element, "grammar-selector:show")).toBe(false);
    activeFragment = fragment;
    expect(lumine.commands.canDispatch(fragment.element, "grammar-selector:show")).toBe(true);
  });
});
