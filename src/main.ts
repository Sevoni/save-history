import { Notice, Plugin, TFile } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";
import { SaveHistorySettingTab } from "./settings";
import { setLanguage, translate, type Language } from "./locale";
import { getSnapshotDirPath, renameSnapshotFolder, removeEmptyParentDirs, deleteSnapshotDirForFile, listSnapshotsForFile, saveSnapshotContent } from "./storage";
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

    this.registerEvent(
      (this.app.workspace as any).on("file-menu", (menu: any, file: any) => {
        if (!(file instanceof TFile)) return;
        if (!this.isExtensionAllowed(file.extension)) return;

        menu.addItem((item: any) => {
          item.setTitle(translate("exportAllVersions")).setIcon("download").onClick(async () => {
            try {
              const snapshots = await listSnapshotsForFile(this, file.path);
              if (snapshots.length === 0) {
                this.toast(translate("exportNoVersions"));
                return;
              }
              if (typeof (window as any).showDirectoryPicker !== "function") {
                this.toast(translate("failedLoadSnapshot"));
                return;
              }
              const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
              const baseName = file.name.replace(/\.[^.]+$/, "");
              const folderHandle = await dirHandle.getDirectoryHandle(baseName, { create: true });
              for (const snap of snapshots) {
                const safeTs = snap.timestamp.replace(/[:.]/g, "-").slice(0, 19);
                const fileName = `${snap.reason}_${safeTs}.${file.extension}`;
                const fh = await folderHandle.getFileHandle(fileName, { create: true });
                const writable = await fh.createWritable();
                await writable.write(snap.content);
                await writable.close();
              }
              this.toast(translate("exportAllSuccess", { path: baseName }));
            } catch (e: any) {
              if (e?.name !== "AbortError") {
                this.toast(translate("failedLoadSnapshot"));
              }
            }
          });
        });

        menu.addItem((item: any) => {
          item.setTitle(translate("importVersions")).setIcon("upload").onClick(() => {
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;

            input.style.display = "none";
            document.body.appendChild(input);
            input.addEventListener("change", async () => {
              try {
                const fileList = input.files;
                if (!fileList || fileList.length === 0) {
                  this.toast(translate("importNoFiles"));
                  return;
                }
                const now = Date.now();
                for (let i = 0; i < fileList.length; i++) {
                  const f = fileList[i];
                  const raw = await f.text();
                  try {
                    const record = JSON.parse(raw);
                    if (record.path && record.content && record.timestamp) {
                      await saveSnapshotContent(this, file.path, record.timestamp, record.content, record.reason || "import");
                    } else {
                      const nameNoExt = f.name.replace(/\.[^.]+$/, "");
                      const tsMatch = nameNoExt.match(/^(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$/);
                      if (tsMatch) {
                        const reason = tsMatch[1];
                        const ts = tsMatch[2].replace(/T(\d{2})-(\d{2})-(\d{2})$/, "T$1:$2:$3");
                        await saveSnapshotContent(this, file.path, ts, raw, reason);
                      } else {
                        const ts = new Date(now + i).toISOString();
                        await saveSnapshotContent(this, file.path, ts, raw, nameNoExt);
                      }
                    }
                  } catch {
                    const nameNoExt = f.name.replace(/\.[^.]+$/, "");
                    const tsMatch = nameNoExt.match(/^(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$/);
                    if (tsMatch) {
                      const reason = tsMatch[1];
                      const ts = tsMatch[2].replace(/T(\d{2})-(\d{2})-(\d{2})$/, "T$1:$2:$3");
                      await saveSnapshotContent(this, file.path, ts, raw, reason);
                    } else {
                      const ts = new Date(now + i).toISOString();
                      await saveSnapshotContent(this, file.path, ts, raw, nameNoExt);
                    }
                  }
                }
                this.toast(translate("importSuccess"));
                const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
                for (const leaf of leaves) {
                  if (leaf.view instanceof SaveHistoryView) {
                    leaf.view.refresh();
                  }
                }
              } catch {
                this.toast(translate("failedLoadSnapshot"));
              } finally {
                input.remove();
              }
            });
            input.click();
        });
        });
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
