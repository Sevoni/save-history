# Save History

[Русская версия](README.ru.md)

Obsidian plugin for saving and restoring markdown file versions.

## Features

- **Manual version saving** — save the current state of a file at any time
- **Version restore** — restore any previously saved version with one click
- **Pre-restore backup** — before restoring, the current state is automatically saved as a backup
- **Diff comparison** — compare any two versions or a version with the current file
- **Preview modal** — preview a version before restoring (draggable and resizable)
- **Version grouping** — group versions by day, week, month, or year
- **Rename labels** — give custom names to saved versions
- **Multi-language** — English and Russian interface
- **Customizable snapshot folder** — change where versions are stored
- **Delete with confirmation** — safe deletion with confirmation prompt

## Installation

### From GitHub Releases

1. Download the latest release zip from [Releases](https://github.com/Sevoni/save-history/releases)
2. Extract `main.js` and `manifest.json` into your vault's `.obsidian/plugins/save history/` folder
3. Enable the plugin in Obsidian settings → Community plugins

### Manual

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/save history/` folder

## Usage

- Open a markdown file in Obsidian
- Use the sidebar panel "File History" to view and manage versions
- Or use commands from the command palette:
  - **Save version now** — save the current state
  - **Restore version** — open the restore modal
  - **Open history sidebar** — open the version list panel
  - **Restore last unsaved version** — restore the pre-restore backup

## Development

```bash
npm install
npm run build
```

To watch for changes:

```bash
npm run watch
```

## License

MIT
