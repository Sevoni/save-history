import { Notice, Plugin, TFile, TFolder, TAbstractFile, Menu, MenuItem, EventRef } from "obsidian";
import { setupVersioning } from "./versioning";
import { registerCommands, SaveHistoryView, VIEW_TYPE_SAVE_HISTORY } from "./ui";
import { SaveHistorySettingTab } from "./settings";
import { setLanguage, translate, type Language } from "./locale";
import { getSnapshotDirPath, renameSnapshotFolder, removeEmptyParentDirs, deleteSnapshotDirForFile, listSnapshotsForFile, saveSnapshotContent, ensureExportDir, getExportFolderPath } from "./storage";
import { AutosaveManager } from "./autosave";

export type GroupByMode = "none" | "day" | "week" | "month" | "year";
type Versioning = ReturnType<typeof setupVersioning>;

export interface PerFileSettings {
  autosaveInterval?: number;
  autosaveOnTabClose?: boolean;
  maxAutosaveVersions?: number;
  groupBy?: GroupByMode;
}

export interface SaveHistorySettings {
  groupBy: GroupByMode;
  collapsedGroups: Record<string, boolean>;
  language: Language;
  snapshotFolder: string;
  exportFolder: string;
  autosaveInterval: number;
  autosaveOnTabClose: boolean;
  maxAutosaveVersions: number;
  allowedExtensions: string;
  perFileSettings: Record<string, PerFileSettings>;
}

const DEFAULT_SETTINGS: SaveHistorySettings = {
  groupBy: "day",
  collapsedGroups: {},
  language: "system",
  snapshotFolder: ".versions(SH)",
  exportFolder: "Exported versions",
  autosaveInterval: 0,
  autosaveOnTabClose: false,
  maxAutosaveVersions: 0,
  allowedExtensions: "",
  perFileSettings: {},
};

export class SaveHistoryPlugin extends Plugin {
  settings: SaveHistorySettings = DEFAULT_SETTINGS;
  autosaveManager: AutosaveManager | null = null;
  versioning!: Versioning;
  private lastActiveFile: TFile | null = null;
  private tabCloseEventRef: EventRef | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.versioning = setupVersioning(this);

    this.registerView(
      VIEW_TYPE_SAVE_HISTORY,
      (leaf) => new SaveHistoryView(leaf, this, this.versioning)
    );

    registerCommands(this, this.versioning);

    this.autosaveManager = new AutosaveManager(this, this.versioning);
    this.autosaveManager.start();

    this.registerTabCloseListener();

    this.addRibbonIcon("history", translate("viewTitle"), () => {
      void (async () => {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY)[0];
        if (!leaf) {
          const rightLeaf = this.app.workspace.getRightLeaf(false);
          if (rightLeaf) {
            leaf = rightLeaf;
            await leaf.setViewState({
              type: VIEW_TYPE_SAVE_HISTORY,
              active: true,
            });
          }
        }
        if (leaf) {
          this.app.workspace.revealLeaf(leaf);
        }
      })();
    });

    this.addSettingTab(new SaveHistorySettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!(file instanceof TFile) && !(file instanceof TFolder)) return;
        if (file instanceof TFile && !this.isExtensionAllowed(file.extension)) return;

        const oldDir = getSnapshotDirPath(this, oldPath);
        const newDir = getSnapshotDirPath(this, file.path);

        // Don't await rename — it can be slow on Windows
        const renamePromise = renameSnapshotFolder(this.app.vault.adapter, oldDir, newDir);

        // Refresh views immediately — no delay for the user
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
        const refreshViews = () => {
          for (const leaf of leaves) {
            if (leaf.view instanceof SaveHistoryView) {
              void leaf.view.refresh();
            }
          }
        };
        refreshViews();

        // Update perFileSettings keys (fast — memory only)
        const isFolder = file instanceof TFolder;
        const keysToUpdate: string[] = [];
        for (const key of Object.keys(this.settings.perFileSettings)) {
          if (isFolder) {
            if (key === oldPath || key.startsWith(oldPath + "/")) {
              keysToUpdate.push(key);
            }
          } else {
            if (key === oldPath) keysToUpdate.push(key);
          }
        }
        for (const key of keysToUpdate) {
          const newKey = isFolder
            ? file.path + key.substring(oldPath.length)
            : file.path;
          this.settings.perFileSettings[newKey] = this.settings.perFileSettings[key];
          delete this.settings.perFileSettings[key];
        }
        if (keysToUpdate.length > 0) await this.saveSettings();

        // Refresh sidebar after rename completes
        void renamePromise.then(refreshViews).catch(() => {});

        const parentDir = oldDir.substring(0, oldDir.lastIndexOf("/"));
        void removeEmptyParentDirs(this, parentDir);
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
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile, _source: string) => {
        if (!(file instanceof TFile)) return;
        if (!this.isExtensionAllowed(file.extension)) return;

        menu.addItem((item: MenuItem) => {
          item.setTitle(translate("exportAllVersions")).setIcon("download").onClick(() => {
            void (async () => {
              const snapshots = await listSnapshotsForFile(this, file.path);
              if (snapshots.length === 0) {
                this.toast(translate("exportNoVersions"));
                return;
              }

              if (!this.app.isMobile) {
                const w = window as unknown as { showDirectoryPicker?: (opts: { mode: string }) => Promise<unknown> };
                if (typeof w.showDirectoryPicker === "function") {
                  try {
                    interface DirHandle {
                      getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
                      getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
                    }
                    interface FileHandle {
                      createWritable(): Promise<{ write(data: string | BufferSource | Blob): Promise<void>; close(): Promise<void> }>;
                    }
                    const dirHandle = await w.showDirectoryPicker({ mode: "readwrite" }) as DirHandle;
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    const folderHandle = await dirHandle.getDirectoryHandle(baseName, { create: true });
                    for (const snap of snapshots) {
                      const d = new Date(snap.timestamp);
                      const safeTs = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}-${String(d.getSeconds()).padStart(2, "0")}`;
                      const fileName = `${snap.name}_${safeTs}.${file.extension}`;
                      const fh = await folderHandle.getFileHandle(fileName, { create: true });
                      const writable = await fh.createWritable();
                      await writable.write(snap.content);
                      await writable.close();
                    }
                    this.toast(translate("exportAllSuccess", { path: baseName }));
                    return;
                  } catch (e: unknown) {
                    if ((e as { name?: string })?.name === "AbortError") return;
                  }
                }
              }

              const baseName = file.name.replace(/\.[^.]+$/, "");
              const exportDir = getExportFolderPath(this);
              const adapter = this.app.vault.adapter;
              await ensureExportDir(this);
              for (const snap of snapshots) {
                const d = new Date(snap.timestamp);
                const safeTs = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}-${String(d.getSeconds()).padStart(2, "0")}`;
                const fileName = `${baseName}_${snap.name}_${safeTs}.${file.extension}`;
                await adapter.write(`${exportDir}/${fileName}`, snap.content);
              }
              this.toast(translate("exportAllSuccess", { path: exportDir }));
            })();
          });
        });

        menu.addItem((item: MenuItem) => {
          item.setTitle(translate("importVersions")).setIcon("upload").onClick(() => {
            const doc = activeDocument!;
            const input = doc.createElement("input");
            input.type = "file";
            input.multiple = true;
            input.classList.add("sh-import-input");
            doc.body.appendChild(input);
            input.addEventListener("change", () => {
              void (async () => {
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
                    const nameOnly = f.name.replace(/^.*[\\/]/, "");
                    const nameNoExt = nameOnly.replace(/\.[^.]+$/, "").replace(/\.[^.]+$/, "");
                    const tsMatch = nameNoExt.match(/^(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})$/);
                    if (tsMatch) {
                      const reason = tsMatch[1];
                      const ts = new Date(tsMatch[2].replace(/T(\d{2})-(\d{2})-(\d{2})$/, "T$1:$2:$3")).toISOString();
                      await saveSnapshotContent(this, file.path, ts, raw, reason);
                    } else {
                      try {
                        const record = JSON.parse(raw) as Record<string, unknown>;
                        if (typeof record.content === "string" && typeof record.timestamp === "string") {
                          const ts = new Date(record.timestamp).toISOString();
                          await saveSnapshotContent(this, file.path, ts, record.content, typeof record.name === "string" ? record.name : typeof record.reason === "string" ? record.reason : "import");
                        } else {
                          const ts = new Date(now + i).toISOString();
                          await saveSnapshotContent(this, file.path, ts, raw, nameNoExt);
                        }
                      } catch {
                        const ts = new Date(now + i).toISOString();
                        await saveSnapshotContent(this, file.path, ts, raw, nameNoExt);
                      }
                    }
                  }
                  this.toast(translate("importSuccess"));
                  const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
                  for (const leaf of leaves) {
                    if (leaf.view instanceof SaveHistoryView) {
                      void leaf.view.refresh();
                    }
                  }
                } catch {
                  this.toast(translate("failedLoadSnapshot"));
                } finally {
                  input.remove();
                }
              })();
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
        this.autosaveManager?.saveOnTabClose(this.lastActiveFile).catch(() => {});
      }
      this.lastActiveFile = file;
    });
    this.registerEvent(this.tabCloseEventRef);
  }

  unregisterTabCloseListener() {
    if (this.tabCloseEventRef) {
      this.app.workspace.offref(this.tabCloseEventRef);
      this.tabCloseEventRef = null;
    }
    this.lastActiveFile = null;
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData());
    if (data) {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }
    setLanguage(this.settings.language);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings as unknown as Record<string, unknown>);
  }

  getFileSettings(filePath: string): PerFileSettings {
    return this.settings.perFileSettings[filePath] || {};
  }

  async setFileSetting<K extends keyof PerFileSettings>(filePath: string, key: K, value: PerFileSettings[K]): Promise<void> {
    if (!this.settings.perFileSettings[filePath]) {
      this.settings.perFileSettings[filePath] = {};
    }
    this.settings.perFileSettings[filePath][key] = value;
    await this.saveSettings();
  }

  async clearFileSetting(filePath: string, key: keyof PerFileSettings): Promise<void> {
    const per = this.settings.perFileSettings[filePath];
    if (per) {
      delete per[key];
      if (Object.keys(per).length === 0) {
        delete this.settings.perFileSettings[filePath];
      }
      await this.saveSettings();
    }
  }

  async resetAllFileSettings(filePath: string): Promise<void> {
    delete this.settings.perFileSettings[filePath];
    await this.saveSettings();
  }

  getEffectiveAutosaveInterval(filePath: string): number {
    const per = this.getFileSettings(filePath);
    if (per.autosaveInterval !== undefined) return per.autosaveInterval;
    return this.settings.autosaveInterval;
  }

  getEffectiveAutosaveOnTabClose(filePath: string): boolean {
    const per = this.getFileSettings(filePath);
    if (per.autosaveOnTabClose !== undefined) return per.autosaveOnTabClose;
    return this.settings.autosaveOnTabClose;
  }

  getEffectiveMaxAutosaveVersions(filePath: string): number {
    const per = this.getFileSettings(filePath);
    if (per.maxAutosaveVersions !== undefined) return per.maxAutosaveVersions;
    return this.settings.maxAutosaveVersions;
  }

  getEffectiveGroupBy(filePath: string): GroupByMode {
    const per = this.getFileSettings(filePath);
    if (per.groupBy !== undefined) return per.groupBy;
    return this.settings.groupBy;
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

  refreshCommands(): void {
    registerCommands(this, this.versioning);
  }

  toast(message: string) {
    new Notice(message);
  }
}