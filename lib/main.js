const GrammarListView = require("./grammar-list-view");
const GrammarStatusView = require("./grammar-status-view");
const { Disposable } = require("lumine");

let commandDisposable = null;
let grammarListView = null;
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
        if (!grammarListView) grammarListView = new GrammarListView();
        grammarListView.toggle(event);
      },
    );
  },

  deactivate() {
    const command = commandDisposable;
    const listView = grammarListView;
    const views = grammarStatusViews;
    commandDisposable = null;
    grammarListView = null;
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

    listView?.destroy();
  },

  consumeStatusBar(statusBar) {
    const views = grammarStatusViews;
    if (!views) return new Disposable();
    let state = views.get(statusBar);
    if (!state) {
      state = { refs: 0, retired: false, view: null };
      views.set(statusBar, state);
      try {
        state.view = new GrammarStatusView(statusBar);
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
