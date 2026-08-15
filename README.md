# grammar-selector

Pick the grammar used for syntax highlighting in the current editor.

## Features

- **Grammar picker**: choose the grammar for the active editor from a searchable list.
- **Current grammar first**: the editor's own grammar sits under Auto Detect, ruled off from the rest.
- **Status bar tile**: shows the active grammar and opens the picker when clicked.
- **Duplicate handling**: optionally hides non-preferred grammars when several match a scope.
- **Configurable placement**: shows the grammar tile on the left or right of the status bar.

## Installation

To install `grammar-selector` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/grammar-selector`.

## Commands

Commands available in `lumine-workspace`:

- `grammar-selector:show`: open the grammar picker for the current editor.

## Services

- `status-bar`: consumed to show the active grammar in the status bar.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
