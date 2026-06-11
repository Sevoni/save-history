"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveHistoryPlugin = void 0;
const obsidian_1 = require("obsidian");
const versioning_1 = require("./versioning");
const ui_1 = require("./ui");
class SaveHistoryPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.disposer = null;
    }
    async onload() {
        const versioning = (0, versioning_1.setupVersioning)(this);
        this.disposer = versioning.startAutosave();
        (0, ui_1.registerCommands)(this, versioning);
    }
    onunload() {
        if (this.disposer)
            this.disposer();
        this.disposer = null;
    }
    getActiveMarkdownFile() {
        const file = this.app.workspace.getActiveFile();
        if (!file)
            return null;
        if (file.extension !== "md")
            return null;
        return file;
    }
    toast(message) {
        new obsidian_1.Notice(message);
    }
}
exports.SaveHistoryPlugin = SaveHistoryPlugin;
//# sourceMappingURL=main.js.map