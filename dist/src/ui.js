"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const obsidian_1 = require("obsidian");
const storage_1 = require("./storage");
function registerCommands(plugin, versioning) {
    plugin.addCommand?.({
        id: "save-history:save-now",
        name: "Save version now",
        callback: async () => {
            const file = plugin.getActiveMarkdownFile();
            if (!file) {
                plugin.toast("Open a markdown (.md) file to save a version.");
                return;
            }
            await versioning.saveNowForFile(file, "manual");
            plugin.toast("Version saved.");
        },
    });
    plugin.addCommand?.({
        id: "save-history:restore",
        name: "Restore version…",
        callback: async () => {
            const file = plugin.getActiveMarkdownFile();
            if (!file) {
                plugin.toast("Open a markdown (.md) file to restore a version.");
                return;
            }
            new RestoreVersionModal(plugin, file, versioning).open();
        },
    });
}
class RestoreVersionModal extends obsidian_1.Modal {
    constructor(plugin, file, versioning) {
        super(plugin.app);
        this.snapshots = [];
        this.plugin = plugin;
        this.file = file;
        this.versioning = versioning;
    }
    async onOpen() {
        const contentEl = this.contentEl;
        const root = contentEl ?? document.createElement("div");
        // Clear
        root.innerHTML = "";
        const title = document.createElement("h2");
        title.textContent = "Restore version";
        root.appendChild(title);
        this.loadingEl = document.createElement("div");
        this.loadingEl.textContent = "Loading versions…";
        root.appendChild(this.loadingEl);
        this.listEl = document.createElement("div");
        root.appendChild(this.listEl);
        await this.refresh();
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.onclick = () => this.close();
        root.appendChild(closeBtn);
        // ensure root is attached if obsidian didn't attach contentEl
        if (!contentEl) {
            // best-effort: do nothing
        }
    }
    async refresh() {
        this.loadingEl.textContent = "Loading versions…";
        this.snapshots = await (0, storage_1.listSnapshotsForFile)(this.plugin, this.file.path);
        this.listEl.innerHTML = "";
        if (!this.snapshots.length) {
            const empty = document.createElement("div");
            empty.textContent = "No saved versions yet.";
            this.listEl.appendChild(empty);
            this.loadingEl.textContent = "";
            return;
        }
        for (const snap of this.snapshots) {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.gap = "12px";
            row.style.margin = "6px 0";
            const meta = document.createElement("div");
            meta.textContent = snap.timestamp + (snap.reason ? ` (${snap.reason})` : "");
            row.appendChild(meta);
            const btn = document.createElement("button");
            btn.textContent = "Restore";
            btn.onclick = async () => {
                await this.restoreSnapshot(snap);
            };
            row.appendChild(btn);
            this.listEl.appendChild(row);
        }
        this.loadingEl.textContent = "";
    }
    async restoreSnapshot(snap) {
        const restored = await (0, storage_1.readSnapshotContent)(this.plugin, this.file.path, snap.timestamp);
        if (!restored) {
            this.plugin.toast("Failed to load selected snapshot.");
            return;
        }
        await this.versioning.restoreFromSnapshot(this.file, restored);
        this.plugin.toast("Version restored.");
        this.close();
    }
}
//# sourceMappingURL=ui.js.map