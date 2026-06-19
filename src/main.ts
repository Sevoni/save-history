import { Notice, Plugin, TFile } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";
import { SaveHistorySettingTab } from "./settings";
import { setLanguage, type Language } from "./locale";
import { getSnapshotDirPath, renameSnapshotFolder, removeEmptyParentDirs, deleteSnapshotDirForFile } from "./storage";
import { AutosaveManager } from "./autosave";

export type GroupByMode = "none" | "day" | "week" | "month" | "year";

export interface SaveHistorySettings {
  groupBy: GroupByMode;
  collapsedGroups: Record<string, boolean>;
  language: Language;
  snapshotFolder: string;
  autosaveInterval: number;
  autosaveOnTabClose: boolean;
  maxAutosaveVersions: number;
  allowedExtensions: string;
}

const DEFAULT_SETTINGS: SaveHistorySettings = {
  groupBy: "day",
  collapsedGroups: {},
  language: "en",
  snapshotFolder: ".versions(SH)",
  autosaveInterval: 0,
  autosaveOnTabClose: false,
  maxAutosaveVersions: 0,
  allowedExtensions: "",
};

export class SaveHistoryPlugin extends Plugin {
  settings: SaveHistorySettings = DEFAULT_SETTINGS;
  autosaveManager: AutosaveManager | null = null;
  private lastActiveFile: TFile | null = null;
  private tabCloseEventRef: any = null;

  async onload() {
    await this.loadSettings();

    const versioning = setupVersioning(this);

    this.registerView(
      VIEW_TYPE_SAVE_HISTORY,
      (leaf) => new SaveHistoryView(leaf, this, versioning)
    );

    registerCommands(this, versioning);

    this.autosaveManager = new AutosaveManager(this, versioning);
    this.autosaveManager.start();

    if (this.settings.autosaveOnTabClose) {
      this.registerTabCloseListener();
    }

    this.addSettingTab(new SaveHistorySettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        if (!this.isExtensionAllowed(file.extension)) return;

        const oldDir = getSnapshotDirPath(this, oldPath);
        const newDir = getSnapshotDirPath(this, file.path);

        await renameSnapshotFolder(this.app.vault.adapter, oldDir, newDir);

        const parentDir = oldDir.substring(0, oldDir.lastIndexOf("/"));
        await removeEmptyParentDirs(this, parentDir);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile)) return;
        if (!this.isExtensionAllowed(file.extension)) return;
        await deleteSnapshotDirForFile(this, file.path);
      })
    );
  }

  onunload() {
    this.unregisterTabCloseListener();
    this.autosaveManager?.stop();
  }

  registerTabCloseListener() {
    if (this.tabCloseEventRef) return;
    this.lastActiveFile = this.getActiveFile();
    this.tabCloseEventRef = this.app.workspace.on("active-leaf-change", () => {
      const file = this.getActiveFile();
      if (this.lastActiveFile && this.lastActiveFile !== file) {
        this.autosaveManager?.saveOnTabClose(this.lastActiveFile);
      }
      this.lastActiveFile = file;
    });
    this.registerEvent(this.tabCloseEventRef);
  }

  unregisterTabCloseListener() {
    if (this.tabCloseEventRef) {
      this.tabCloseEventRef = null;
    }
    this.lastActiveFile = null;
  }

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

  getActiveFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    if (!this.isExtensionAllowed(file.extension)) return null;
    return file;
  }

  isExtensionAllowed(ext: string): boolean {
    const allowed = this.getAllowedExtensions();
    return allowed.has(ext.toLowerCase());
  }

  getAllowedExtensions(): Set<string> {
    const set = new Set<string>(["md"]);
    const raw = this.settings.allowedExtensions;
    if (raw) {
      const parts = raw.split(/[,;\s]+/);
      for (const part of parts) {
        const clean = part.trim().toLowerCase().replace(/^\./, "");
        if (clean) set.add(clean);
      }
    }
    return set;
  }

  toast(message: string) {
    new Notice(message);
  }
}
