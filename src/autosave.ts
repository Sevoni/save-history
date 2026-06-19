import { TFile } from "obsidian";
import type { SaveHistoryPlugin } from "./main";
import type { setupVersioning } from "./versioning";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";

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
    if (file.extension !== "md") return;
    await this.versioning.saveNowForFile(file, "autosave");
    this.refreshSidebar();
  }

  private onTick() {
    const file = this.plugin.getActiveMarkdownFile();
    if (!file) return;

    this.versioning.saveNowForFile(file, "autosave").then(() => this.refreshSidebar());
  }

  private refreshSidebar() {
    const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
    for (const leaf of leaves) {
      if (leaf.view instanceof SaveHistoryView) {
        (leaf.view as SaveHistoryView).refresh();
      }
    }
  }
}
