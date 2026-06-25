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
  private lastAutosaveByFile: Map<string, number> = new Map();
  private readonly TIMER_TOLERANCE_MS = 500;

  constructor(plugin: SaveHistoryPlugin, versioning: Versioning) {
    this.plugin = plugin;
    this.versioning = versioning;
  }

  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      [a, b] = [b, a % b];
    }
    return a;
  }

  start() {
    this.stop();

    let interval = this.plugin.settings.autosaveInterval;
    for (const per of Object.values(this.plugin.settings.perFileSettings)) {
      if (per.autosaveInterval !== undefined && per.autosaveInterval > 0) {
        if (interval <= 0) {
          interval = per.autosaveInterval;
        } else {
          interval = this.gcd(interval, per.autosaveInterval);
        }
      }
    }
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
    this.lastAutosaveByFile.clear();
    this.start();
  }

  async saveOnTabClose(file: TFile) {
    if (!this.plugin.getEffectiveAutosaveOnTabClose(file.path)) return;
    const result = await this.versioning.saveNowForFile(file, "autosave");
    if (result === "saved") {
      await this.enforceMaxAutosaves(file.path);
    }
    this.refreshSidebar();
  }

  private onTick() {
    const file = this.plugin.getActiveFile();
    if (!file) return;

    const effectiveInterval = this.plugin.getEffectiveAutosaveInterval(file.path);
    if (effectiveInterval <= 0) return;

    const now = Date.now();
    const intervalMs = effectiveInterval * 60 * 1000;
    const lastSave = this.lastAutosaveByFile.get(file.path);

    if (lastSave !== undefined && now - lastSave + this.TIMER_TOLERANCE_MS < intervalMs) return;

    this.lastAutosaveByFile.set(file.path, now);
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
    const max = this.plugin.getEffectiveMaxAutosaveVersions(vaultRelativePath);
    if (max <= 0) return;
    await deleteOldestAutosaves(this.plugin, vaultRelativePath, max);
  }
}
