import { Notice, Plugin, TFile } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";
import { SaveHistorySettingTab } from "./settings";
import { setLanguage, type Language } from "./locale";
import { getSnapshotDirPath, renameSnapshotFolder, removeEmptyParentDirs } from "./storage";

export type GroupByMode = "none" | "day" | "week" | "month" | "year";

export interface SaveHistorySettings {
  groupBy: GroupByMode;
  collapsedGroups: Record<string, boolean>;
  language: Language;
  snapshotFolder: string;
}

const DEFAULT_SETTINGS: SaveHistorySettings = {
  groupBy: "day",
  collapsedGroups: {},
  language: "en",
  snapshotFolder: ".versions(SH)",
};

export class SaveHistoryPlugin extends Plugin {
  settings: SaveHistorySettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    const versioning = setupVersioning(this);

    this.registerView(
      VIEW_TYPE_SAVE_HISTORY,
      (leaf) => new SaveHistoryView(leaf, this, versioning)
    );

    registerCommands(this, versioning);

    this.addSettingTab(new SaveHistorySettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        const oldDir = getSnapshotDirPath(this, oldPath);
        const newDir = getSnapshotDirPath(this, file.path);

        await renameSnapshotFolder(this.app.vault.adapter, oldDir, newDir);

        const parentDir = oldDir.substring(0, oldDir.lastIndexOf("/"));
        await removeEmptyParentDirs(this, parentDir);
      })
    );
  }

  onunload() {}

  async loadSettings() {
    const data = await (this as any).loadData?.();
    if (data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
    setLanguage(this.settings.language);
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
