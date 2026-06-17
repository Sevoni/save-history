import { Notice, Plugin, TFile } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";

export type GroupByMode = "none" | "day" | "week" | "month" | "year";

export interface SaveHistorySettings {
  groupBy: GroupByMode;
  collapsedGroups: Record<string, boolean>;
}

const DEFAULT_SETTINGS: SaveHistorySettings = {
  groupBy: "day",
  collapsedGroups: {},
};

export class SaveHistoryPlugin extends Plugin {
  private disposer: (() => void) | null = null;
  settings: SaveHistorySettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    const versioning = setupVersioning(this);

    this.registerView(
      VIEW_TYPE_SAVE_HISTORY,
      (leaf) => new SaveHistoryView(leaf, this, versioning)
    );

    registerCommands(this, versioning);
  }

  onunload() {
    if (this.disposer) this.disposer();
    this.disposer = null;
  }

  async loadSettings() {
    const data = await (this as any).loadData?.();
    if (data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
  }

  async saveSettings() {
    await (this as any).saveData?.(this.settings);
  }

  getActiveMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    if (file.extension !== "md") return null;
    return file;
  }

  toast(message: string) {
    new Notice(message);
  }
}
