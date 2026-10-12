const GrammarListView = require("./grammar-list-view");
const GrammarStatusView = require("./grammar-status-view");
const { Disposable } = require("lumine");

let commandDisposable = null;
let grammarListViews = new Map();
let grammarStatusViews = null;

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "grammar-selector",
      tips: [
        "You can change the language used to highlight the current file with {{ 'grammar-selector:show' | keystroke }}",
      ],
    };
  },

  activate() {
    grammarStatusViews = new Map();
    commandDisposable = lumine.commands.add(
      "lumine-workspace",
      "grammar-selector:show",
      (event) => {
        const window =
          event.context?.window ??
          lumine.workspace.getFocusedWindow() ??
          lumine.workspace.getMainWindow();
        let view = grammarListViews.get(window);
        if (!view) {
          view = new GrammarListView(window);
          const views = grammarListViews;
          views.set(window, view);
          view.disposables.add(
            window.onWillDestroy(() => {
              views.delete(window);
              void view.destroy();
            }),
          );
        }
        return view.toggle(event);
      },
    );
  },

  deactivate() {
    const command = commandDisposable;
    const listViews = grammarListViews;
    const views = grammarStatusViews;
    commandDisposable = null;
    grammarListViews = new Map();
    grammarStatusViews = null;
    command?.dispose();
    if (views) {
      const states = [...views.values()];
      views.clear();
      for (const state of states) {
        state.retired = true;
        state.view?.destroy();
      }
    }

    for (const view of listViews.values()) void view.destroy();
  },

  consumeStatusBar(service) {
    return service.observeWindows(
      (scopedStatusBar, context) => this.consumeWindowStatusBar(scopedStatusBar, context),
      { windows: "all" },
    );
  },

  consumeWindowStatusBar(statusBar, context) {
    const views = grammarStatusViews;
    if (!views) return new Disposable();
    let state = views.get(statusBar);
    if (!state) {
      state = { refs: 0, retired: false, view: null };
      views.set(statusBar, state);
      try {
        state.view = new GrammarStatusView(statusBar, context);
        if (state.retired) state.view.destroy();
      } catch (error) {
        state.retired = true;
        if (views.get(statusBar) === state) views.delete(statusBar);
        throw error;
      }
    }
    state.refs++;
    return new Disposable(() => {
      if (state.retired || --state.refs > 0) return;
      state.retired = true;
      if (views.get(statusBar) === state) views.delete(statusBar);
      state.view?.destroy();
    });
  },
};
