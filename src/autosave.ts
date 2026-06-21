import { TFile } from "obsidian";
import type { SaveHistoryPlugin } from "./main";
import type { setupVersioning } from "./versioning";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";
import { deleteOldestAutosaves } from "./storage";

type Versioning = ReturnType<typeof setupVersioning>;

export class AutosaveManager {
  private plugin: SaveHistoryPlugin;
  private versioning: Versioning;
  private intervalId: number | null = null;

  constructor(plugin: SaveHistoryPlugin, versioning: Versioning) {
    this.plugin = plugin;
    this.versioning = versioning;
  }

  start() {
    this.stop();
    const interval = this.plugin.settings.autosaveInterval;
    if (interval <= 0) return;

    const ms = interval * 60 * 1000;
    const id = window.setInterval(() => this.onTick(), ms);
    this.intervalId = id;
    this.plugin.registerInterval(id);
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restart() {
    this.stop();
    this.start();
  }

  async saveOnTabClose(file: TFile) {
    if (!this.plugin.settings.autosaveOnTabClose) return;
    const result = await this.versioning.saveNowForFile(file, "autosave");
    if (result === "saved") {
      await this.enforceMaxAutosaves(file.path);
    }
    this.refreshSidebar();
  }

  private onTick() {
    const file = this.plugin.getActiveFile();
    if (!file) return;

    this.versioning.saveNowForFile(file, "autosave").then(async (result) => {
      if (result === "saved") {
        await this.enforceMaxAutosaves(file.path);
      }
      this.refreshSidebar();
    }).catch(() => {});
  }

  private refreshSidebar() {
    const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
    for (const leaf of leaves) {
      if (leaf.view instanceof SaveHistoryView) {
        leaf.view.refresh();
      }
    }
  }

  private async enforceMaxAutosaves(vaultRelativePath: string) {
    const max = this.plugin.settings.maxAutosaveVersions;
    if (max <= 0) return;
    await deleteOldestAutosaves(this.plugin, vaultRelativePath, max);
  }
}
