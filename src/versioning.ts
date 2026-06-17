import { TFile } from "obsidian";
import { SaveHistoryPlugin } from "./main";
import { saveSnapshotContent, listSnapshotsForFile, readSnapshotContent } from "./storage";

export function setupVersioning(plugin: SaveHistoryPlugin) {
  async function saveNowForFile(file: TFile, reason: string): Promise<"saved" | "no_change"> {
    if (!file || file.extension !== "md") return "no_change";

    const content = await plugin.app.vault.read(file);
    const vaultRelativePath = file.path;

    const snapshots = await listSnapshotsForFile(plugin, vaultRelativePath);
    const nonPreRestore = snapshots.filter(s => s.reason !== "pre-restore");

    if (nonPreRestore.length > 0) {
      const latest = nonPreRestore[0];
      const latestContent = await readSnapshotContent(plugin, latest.filePath);
      if (latestContent && latestContent.content === content) {
        return "no_change";
      }
    }

    const timestamp = new Date().toISOString();
    await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason);
    return "saved";
  }

  async function restoreFromSnapshot(file: TFile, snapshot: any) {
    if (!file || file.extension !== "md") return;
    if (!snapshot?.content) return;

    await plugin.app.vault.modify(file, snapshot.content);
  }

  return {
    saveNowForFile,
    restoreFromSnapshot,
  };
}
