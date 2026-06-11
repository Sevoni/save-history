"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupVersioning = setupVersioning;
const storage_1 = require("./storage");
function setupVersioning(plugin) {
    let timeoutId = null;
    async function saveNowForFile(file, reason) {
        if (!file || file.extension !== "md")
            return;
        const content = await plugin.app.vault.read(file);
        const vaultRelativePath = file.path; // vault-relative
        const timestamp = new Date().toISOString();
        await (0, storage_1.saveSnapshotContent)(plugin, vaultRelativePath, timestamp, content, reason);
    }
    function startAutosave() {
        // Obsidian fires vault "modify" frequently; debounce by time window.
        const handler = (file) => {
            if (!file || file.extension !== "md")
                return;
            if (timeoutId)
                clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                const current = plugin.getActiveMarkdownFile();
                if (!current)
                    return;
                await saveNowForFile(current, "auto");
            }, 2000);
        };
        plugin.app.vault.on?.("modify", handler);
        return () => {
            if (timeoutId)
                clearTimeout(timeoutId);
            timeoutId = null;
            plugin.app.vault.off?.("modify", handler);
        };
    }
    async function restoreFromSnapshot(file, snapshot) {
        if (!file || file.extension !== "md")
            return;
        if (!snapshot?.content)
            return;
        await plugin.app.vault.modify(file, snapshot.content);
    }
    return {
        startAutosave,
        saveNowForFile,
        restoreFromSnapshot,
    };
}
//# sourceMappingURL=versioning.js.map