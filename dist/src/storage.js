"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSnapshotDirPath = getSnapshotDirPath;
exports.getSnapshotFilePath = getSnapshotFilePath;
exports.ensureSnapshotDir = ensureSnapshotDir;
exports.saveSnapshotContent = saveSnapshotContent;
exports.listSnapshotsForFile = listSnapshotsForFile;
exports.readSnapshotContent = readSnapshotContent;
const SNAPSHOT_ROOT = "versions";
function getSnapshotDirPath(vaultRelativePath) {
    const normalized = vaultRelativePath.replace(/^\/+/, "");
    // versions/<vaultRelativePath>
    return `${SNAPSHOT_ROOT}/${normalized}`;
}
function getSnapshotFilePath(vaultRelativePath, timestamp) {
    return `${getSnapshotDirPath(vaultRelativePath)}/${timestamp}.json`;
}
async function ensureSnapshotDir(plugin, vaultRelativePath) {
    const dirPath = getSnapshotDirPath(vaultRelativePath);
    await plugin.app.vault.adapter.mkdirp(dirPath);
}
async function saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason) {
    await ensureSnapshotDir(plugin, vaultRelativePath);
    const record = { path: vaultRelativePath, timestamp, content, reason };
    const filePath = getSnapshotFilePath(vaultRelativePath, timestamp);
    const vaultAny = plugin.app.vault;
    // Preferred attempt: create/modify abstract file (API differs across versions/builds)
    if (vaultAny.getAbstractFileByPath && vaultAny.modifyAbstractFile) {
        const existing = await vaultAny.getAbstractFileByPath(filePath);
        if (existing) {
            await vaultAny.modifyAbstractFile(existing, JSON.stringify(record, null, 2));
            return;
        }
    }
    if (vaultAny.create) {
        await vaultAny.create(filePath, JSON.stringify(record, null, 2));
        return;
    }
    const adapterAny = plugin.app.vault.adapter;
    if (adapterAny.write) {
        await adapterAny.write(filePath, JSON.stringify(record, null, 2));
        return;
    }
    throw new Error("No supported method to write snapshot files in this Obsidian build.");
}
async function listSnapshotsForFile(plugin, vaultRelativePath) {
    const dirPath = getSnapshotDirPath(vaultRelativePath);
    const vaultAny = plugin.app.vault;
    const adapterAny = plugin.app.vault.adapter;
    let files = [];
    if (adapterAny.readDir) {
        files = await adapterAny.readDir(dirPath);
    }
    else if (vaultAny.getFiles) {
        // Fallback: best-effort scan (can be slow)
        const all = await vaultAny.getFiles();
        files = all.filter((f) => typeof f?.path === "string" && f.path.startsWith(dirPath + "/"));
    }
    else {
        return [];
    }
    const jsonFiles = files
        .map((f) => f.path)
        .filter((p) => typeof p === "string" && p.endsWith(".json"))
        .sort();
    const snapshots = [];
    for (const p of jsonFiles) {
        const abstract = vaultAny.getAbstractFileByPath ? await vaultAny.getAbstractFileByPath(p) : null;
        if (!abstract)
            continue;
        const json = vaultAny.read ? await vaultAny.read(abstract) : null;
        if (!json || typeof json !== "string")
            continue;
        try {
            snapshots.push(JSON.parse(json));
        }
        catch {
            // ignore invalid snapshot
        }
    }
    // newest first
    snapshots.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
    return snapshots;
}
async function readSnapshotContent(plugin, vaultRelativePath, timestamp) {
    const vaultAny = plugin.app.vault;
    const filePath = getSnapshotFilePath(vaultRelativePath, timestamp);
    const abstract = vaultAny.getAbstractFileByPath ? await vaultAny.getAbstractFileByPath(filePath) : null;
    if (!abstract)
        return null;
    const json = vaultAny.read ? await vaultAny.read(abstract) : null;
    if (!json || typeof json !== "string")
        return null;
    try {
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=storage.js.map