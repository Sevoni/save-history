import { TFile } from "obsidian";
import { SaveHistoryPlugin } from "./main";
import { saveSnapshotContent } from "./storage";

export function setupVersioning(plugin: SaveHistoryPlugin) {
  let timeoutId: any = null;

  async function saveNowForFile(file: TFile, reason: string) {
    if (!file || file.extension !== "md") return;

    const content = await plugin.app.vault.read(file);
    const vaultRelativePath = file.path; // vault-relative

    const timestamp = new Date().toISOString();
    await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason);
  }

  function startAutosave() {
    // Obsidian fires vault "modify" frequently; debounce by time window.
    const handler = (file: TFile) => {
      if (!file || file.extension !== "md") return;

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        const current = plugin.getActiveMarkdownFile();
        if (!current) return;
        await saveNowForFile(current, "auto");
      }, 2000);
    };

    (plugin.app.vault as any).on?.("modify", handler);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      (plugin.app.vault as any).off?.("modify", handler);
    };
  }

  async function restoreFromSnapshot(file: TFile, snapshot: any) {
    if (!file || file.extension !== "md") return;
    if (!snapshot?.content) return;

    await plugin.app.vault.modify(file, snapshot.content);
  }

  return {
    startAutosave,
    saveNowForFile,
    restoreFromSnapshot,
  };
}
