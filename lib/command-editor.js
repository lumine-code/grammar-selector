function itemAllowsGrammar(item) {
  return Boolean(
    !item?.isDestroyed?.() &&
    (typeof item?.getActiveEmbeddedTextEditor !== "function" || item.getActiveEmbeddedTextEditor()),
  );
}

function commandEditor(event) {
  const context = event?.context ?? lumine.workspace.resolveCommandContext(event);
  return {
    item: context.documentItem,
    editor: itemAllowsGrammar(context.documentItem) ? (context.embeddedEditor ?? null) : null,
  };
}

module.exports = { commandEditor, itemAllowsGrammar };
