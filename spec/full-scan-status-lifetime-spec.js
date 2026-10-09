describe("grammar-selector full-scan status service lifetime", () => {
  let main, hub, consumer, bars, providers, StatusBarView;
  const tiles = (bar) =>
    [...bar.getLeftTiles(), ...bar.getRightTiles()].filter((tile) =>
      tile.getItem().matches?.(".grammar-status"),
    );
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    await lumine.packages.activatePackage("status-bar");
    main = (await lumine.packages.activatePackage("grammar-selector")).mainModule;
    StatusBarView = lumine.packages.getActivePackage("status-bar").mainModule.statusBar.constructor;
    await lumine.workspace.open();
    hub = new lumine.packages.serviceHub.constructor();
    consumer = hub.consume("status-bar", "^1.0.0", (bar) => main.consumeStatusBar(bar));
    bars = [];
    providers = [];
  });
  afterEach(async () => {
    consumer.dispose();
    for (const provider of providers) provider.dispose();
    await lumine.packages.deactivatePackage("grammar-selector");
    for (const bar of bars) {
      for (const tile of tiles(bar)) tile.destroy();
      bar.destroy();
    }
  });
  const provide = (bar = null) => {
    if (!bar) {
      bar = new StatusBarView();
      bars.push(bar);
      jasmine.attachToDOM(bar.element);
    }
    const provider = hub.provide("status-bar", "1.0.0", bar);
    providers.push(provider);
    return { bar, provider };
  };
  it("shares identical service payloads until the final registration is withdrawn", async () => {
    const first = provide(),
      second = provide(first.bar);
    await Promise.resolve();
    expect(tiles(first.bar).length).toBe(1);
    first.provider.dispose();
    expect(tiles(first.bar).length).toBe(1);
    second.provider.dispose();
    expect(tiles(first.bar).length).toBe(0);
  });
  it("retires every manually connected provider on package deactivation", async () => {
    const first = provide(),
      second = provide();
    await Promise.resolve();
    await lumine.packages.deactivatePackage("grammar-selector");
    expect(tiles(first.bar).length).toBe(0);
    expect(tiles(second.bar).length).toBe(0);
  });
  it("keeps a later activation's exact same-payload tile alive when the old provider is withdrawn", async () => {
    const old = provide();
    await Promise.resolve();
    await lumine.packages.deactivatePackage("grammar-selector");
    main = (await lumine.packages.activatePackage("grammar-selector")).mainModule;
    const current = provide(old.bar);
    await Promise.resolve();
    old.provider.dispose();
    expect(tiles(current.bar).length).toBe(1);
    current.provider.dispose();
    expect(tiles(current.bar).length).toBe(0);
  });

  it("cleans staged grammar views when tile creation reenters package deactivation", async () => {
    const bar = new StatusBarView();
    bars.push(bar);
    const add = bar.addRightTile.bind(bar);
    let staged;
    spyOn(bar, "addRightTile").and.callFake((options) => {
      staged = options.item;
      const tile = add(options);
      main.deactivate();
      return tile;
    });
    jasmine.attachToDOM(bar.element);
    const lease = main.consumeStatusBar(bar);
    await Promise.resolve();
    expect(tiles(bar).length).toBe(0);
    expect(lumine.tooltips.findTooltips(staged)).toEqual([]);
    lease.dispose();
  });

  it("applies side configuration once to every distinct live bar", async () => {
    const first = provide(),
      second = provide();
    await Promise.resolve();
    lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", false);
    for (const { bar } of [first, second]) {
      expect(
        bar.getLeftTiles().filter((tile) => tile.getItem().matches?.(".grammar-status")).length,
      ).toBe(1);
      expect(
        bar.getRightTiles().filter((tile) => tile.getItem().matches?.(".grammar-status")).length,
      ).toBe(0);
    }
    lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", true);
    for (const { bar } of [first, second]) {
      expect(
        bar.getLeftTiles().filter((tile) => tile.getItem().matches?.(".grammar-status")).length,
      ).toBe(0);
      expect(
        bar.getRightTiles().filter((tile) => tile.getItem().matches?.(".grammar-status")).length,
      ).toBe(1);
    }
    lumine.config.unset("grammar-selector.showOnRightSideOfStatusBar");
  });

  it("does not destroy a replacement picker created while an old tile is disposed", async () => {
    const hosts = [],
      add = lumine.workspace.addSelectList.bind(lumine.workspace);
    spyOn(lumine.workspace, "addSelectList").and.callFake((...args) => {
      const host = add(...args);
      hosts.push(host);
      return host;
    });
    const workspace = lumine.views.getView(lumine.workspace);
    lumine.commands.dispatch(workspace, "grammar-selector:show");
    await globalThis.conditionPromise(() => hosts[0]?.isVisible());
    hosts[0].cancel();
    const entry = provide();
    const tile = tiles(entry.bar)[0],
      destroy = tile.destroy.bind(tile);
    let currentLease;
    spyOn(tile, "destroy").and.callFake(() => {
      main.activate();
      lumine.commands.dispatch(workspace, "grammar-selector:show");
      currentLease = main.consumeStatusBar(entry.bar);
      destroy();
    });
    main.deactivate();
    await Promise.resolve();
    expect(hosts.length).toBe(2);
    if (hosts[1]) await globalThis.conditionPromise(() => hosts[1].isVisible());
    expect(hosts[1]?.isVisible()).toBe(true);
    expect(tiles(entry.bar).length).toBe(1);
    currentLease.dispose();
  });

  it("keeps only the newer side's tile when creation changes side configuration", async () => {
    const bar = new StatusBarView();
    bars.push(bar);
    jasmine.attachToDOM(bar.element);
    const add = bar.addRightTile.bind(bar);
    let changed = false;
    spyOn(bar, "addRightTile").and.callFake((options) => {
      const tile = add(options);
      if (!changed) {
        changed = true;
        lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", false);
      }
      return tile;
    });
    const lease = main.consumeStatusBar(bar);
    expect(tiles(bar).length).toBe(1);
    expect(bar.getLeftTiles().length).toBe(1);
    expect(bar.getRightTiles().length).toBe(0);
    expect(bar.leftPanel.querySelector(".grammar-status")?.isConnected).toBe(true);
    lumine.config.set("grammar-selector.showOnRightSideOfStatusBar", true);
    expect(tiles(bar).length).toBe(1);
    expect(bar.getLeftTiles().length).toBe(0);
    expect(bar.getRightTiles().length).toBe(1);
    expect(bar.rightPanel.querySelector(".grammar-status")?.isConnected).toBe(true);
    lease.dispose();
    expect(tiles(bar).length).toBe(0);
    lumine.config.unset("grammar-selector.showOnRightSideOfStatusBar");
  });
});
