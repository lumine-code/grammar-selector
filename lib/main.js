const GrammarListView = require("./grammar-list-view");
const GrammarStatusView = require("./grammar-status-view");

let commandDisposable = null;
let grammarListView = null;
let grammarStatusView = null;

module.exports = {
  activate() {
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
    if (commandDisposable) commandDisposable.dispose();
    commandDisposable = null;

    if (grammarStatusView) grammarStatusView.destroy();
    grammarStatusView = null;

    if (grammarListView) grammarListView.destroy();
    grammarListView = null;
  },

  consumeStatusBar(statusBar) {
    grammarStatusView = new GrammarStatusView(statusBar);
    grammarStatusView.attach();
  },
};
