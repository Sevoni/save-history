import { Modal, TFile, ItemView, WorkspaceLeaf } from "obsidian";
import { SaveHistoryPlugin } from "./main";
import { listSnapshotsForFile, readSnapshotContent, deleteSnapshotFile, updateSnapshotLabel, savePreRestoreBackup } from "./storage";
import type { SnapshotRecord } from "./storage";

export const VIEW_TYPE_SAVE_HISTORY = "save-history-view";

export function registerCommands(plugin: SaveHistoryPlugin, versioning: any) {
  plugin.addCommand?.({
    id: "save-history:save-now",
    name: "Save version now",
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast("Open a markdown (.md) file to save a version.");
        return;
      }
      await versioning.saveNowForFile(file, "manual");
      plugin.toast("Version saved.");
      
      // Refresh active view if open
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
      for (const leaf of leaves) {
        if (leaf.view instanceof SaveHistoryView) {
          leaf.view.refresh();
        }
      }
    },
  } as any);

  plugin.addCommand?.({
    id: "save-history:restore",
    name: "Restore version…",
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast("Open a markdown (.md) file to restore a version.");
        return;
      }
      new RestoreVersionModal(plugin, file, versioning).open();
    },
  } as any);

  plugin.addCommand?.({
    id: "save-history:open-sidebar",
    name: "Open history sidebar",
    callback: async () => {
      let leaf = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY)[0];
      if (!leaf) {
        const rightLeaf = plugin.app.workspace.getRightLeaf(false);
        if (rightLeaf) {
          leaf = rightLeaf;
          await leaf.setViewState({
            type: VIEW_TYPE_SAVE_HISTORY,
            active: true,
          });
        }
      }
      if (leaf) {
        plugin.app.workspace.revealLeaf(leaf);
      }
    },
  } as any);
}

export class SaveHistoryView extends ItemView {
  private plugin: SaveHistoryPlugin;
  private versioning: any;
  private container: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: SaveHistoryPlugin, versioning: any) {
    super(leaf);
    this.plugin = plugin;
    this.versioning = versioning;
    this.container = this.containerEl;

    this.plugin.registerEvent(
      this.plugin.app.workspace.on("file-open", () => this.refresh())
    );
  }

  getViewType(): string {
    return VIEW_TYPE_SAVE_HISTORY;
  }

  getDisplayText(): string {
    return "File History";
  }

  getIcon(): string {
    return "history";
  }

  async onOpen() {
    this.container.empty();
    
    const wrapper = this.container.createDiv({ cls: "save-history-sidebar" });
    wrapper.style.padding = "12px";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "12px";
    wrapper.style.height = "100%";
    wrapper.style.overflowY = "auto";

    const header = wrapper.createEl("h3", { text: "File History" });
    header.style.margin = "0 0 8px 0";

    const activeFile = this.plugin.getActiveMarkdownFile();
    if (!activeFile) {
      wrapper.createDiv({ text: "No active markdown file.", cls: "nav-header" });
      return;
    }

    const fileLabel = wrapper.createDiv();
    fileLabel.style.fontSize = "0.85em";
    fileLabel.style.color = "var(--text-muted)";
    fileLabel.style.marginBottom = "8px";
    fileLabel.textContent = `File: ${activeFile.name}`;

    const saveBtn = wrapper.createEl("button", { text: "Save version now" });
    saveBtn.style.width = "100%";
    saveBtn.onclick = async () => {
      const curFile = this.plugin.getActiveMarkdownFile();
      if (!curFile) return;
      await this.versioning.saveNowForFile(curFile, "manual");
      this.plugin.toast("Version saved.");
      this.refresh();
    };

    const listContainer = wrapper.createDiv();
    listContainer.style.display = "flex";
    listContainer.style.flexDirection = "column";
    listContainer.style.gap = "8px";

    const allSnapshots = await listSnapshotsForFile(this.plugin, activeFile.path);
    const snapshots = allSnapshots.filter(s => s.reason !== "pre-restore");
    const preRestoreBackup = allSnapshots.find(s => s.reason === "pre-restore");

    if (snapshots.length === 0) {
      listContainer.createDiv({ text: "No saved versions yet." });
    } else {
      for (const snap of snapshots) {
        const item = listContainer.createDiv();
        item.style.padding = "8px";
        item.style.border = "1px solid var(--background-modifier-border)";
        item.style.borderRadius = "4px";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "4px";

        const date = new Date(snap.timestamp);

        const meta = item.createDiv();
        meta.style.fontSize = "0.85em";
        meta.style.display = "flex";
        meta.style.alignItems = "center";
        meta.style.justifyContent = "space-between";

        const renderNormalState = () => {
          meta.empty();
          
          const textSpan = meta.createEl("span");
          textSpan.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${snap.reason})`;

          const editBtn = meta.createEl("span", { text: "✏️" });
          editBtn.style.cursor = "pointer";
          editBtn.style.marginLeft = "6px";
          editBtn.title = "Rename version";
          editBtn.onclick = (e) => {
            e.stopPropagation();
            renderEditState();
          };
        };

        const renderEditState = () => {
          meta.empty();
          
          const input = meta.createEl("input");
          input.type = "text";
          input.value = snap.reason;
          input.style.flexGrow = "1";
          input.style.marginRight = "6px";
          input.style.fontSize = "0.95em";
          input.style.padding = "2px 4px";
          input.style.height = "24px";
          
          const saveLabel = async () => {
            const val = input.value.trim();
            if (val === "") return;
            const success = await updateSnapshotLabel(this.plugin, snap.filePath, val);
            if (success) {
              this.plugin.toast("Label updated.");
              this.refresh();
            } else {
              this.plugin.toast("Failed to update label.");
              renderNormalState();
            }
          };

          input.onkeydown = async (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              await saveLabel();
            } else if (ev.key === "Escape") {
              ev.preventDefault();
              renderNormalState();
            }
          };

          const controls = meta.createDiv();
          controls.style.display = "flex";
          controls.style.gap = "4px";

          const okBtn = controls.createEl("span", { text: "✔️" });
          okBtn.style.cursor = "pointer";
          okBtn.title = "Save";
          okBtn.onclick = async (ev) => {
            ev.stopPropagation();
            await saveLabel();
          };

          const cancelBtn = controls.createEl("span", { text: "❌" });
          cancelBtn.style.cursor = "pointer";
          cancelBtn.title = "Cancel";
          cancelBtn.onclick = (ev) => {
            ev.stopPropagation();
            renderNormalState();
          };

          // Auto-focus input
          setTimeout(() => input.focus(), 50);
        };

        renderNormalState();

        const actions = item.createDiv();
        actions.style.display = "flex";
        actions.style.flexWrap = "wrap";
        actions.style.gap = "4px";

        const restoreBtn = actions.createEl("button", { text: "Restore" });
        restoreBtn.style.flex = "1 1 70px";
        restoreBtn.onclick = async () => {
          const curFile = this.plugin.getActiveMarkdownFile();
          if (!curFile) return;

          // Auto-save current content as "pre-restore" backup before restoring
          const currentContent = await this.plugin.app.vault.read(curFile);
          await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

          const restored = await readSnapshotContent(this.plugin, snap.filePath);
          if (!restored) {
            this.plugin.toast("Failed to load selected snapshot.");
            return;
          }
          await this.versioning.restoreFromSnapshot(curFile, restored);
          this.plugin.toast("Version restored. Current state backed up below.");
          this.refresh();
        };

        const previewBtn = actions.createEl("button", { text: "Preview" });
        previewBtn.style.flex = "1 1 70px";
        previewBtn.onclick = async () => {
          const curFile = this.plugin.getActiveMarkdownFile();
          if (!curFile) return;
          const restored = await readSnapshotContent(this.plugin, snap.filePath);
          if (!restored) return;
          
          // Simple preview modal
          const previewModal = new Modal(this.plugin.app);
          previewModal.onOpen = () => {
            const el = previewModal.contentEl;
            el.empty();
            el.createEl("h2", { text: `Preview: ${date.toLocaleTimeString()}` });
            const pre = el.createEl("pre");
            pre.style.whiteSpace = "pre-wrap";
            pre.style.maxHeight = "400px";
            pre.style.overflowY = "auto";
            pre.style.padding = "10px";
            pre.style.border = "1px solid var(--background-modifier-border)";
            pre.textContent = restored.content;
            
            const btnRow = el.createDiv();
            btnRow.style.marginTop = "12px";
            btnRow.style.display = "flex";
            btnRow.style.gap = "8px";
            
            const rst = btnRow.createEl("button", { text: "Restore This Version" });
            rst.onclick = async () => {
              // Auto-save current content as "pre-restore" backup before restoring
              const currentContent = await this.plugin.app.vault.read(curFile);
              await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

              await this.versioning.restoreFromSnapshot(curFile, restored);
              this.plugin.toast("Version restored. Current state backed up below.");
              previewModal.close();
              this.refresh();
            };
            
            const cls = btnRow.createEl("button", { text: "Close" });
            cls.onclick = () => previewModal.close();
          };
          previewModal.open();
        };

        const deleteBtn = actions.createEl("button", { text: "Delete" });
        deleteBtn.style.flex = "1 1 70px";
        deleteBtn.style.color = "var(--text-error)";
        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          const curFile = this.plugin.getActiveMarkdownFile();
          if (!curFile) return;
          
          actions.empty();
          
          const confirmText = actions.createEl("span", { text: "Delete?" });
          confirmText.style.fontSize = "0.85em";
          confirmText.style.color = "var(--text-error)";
          confirmText.style.alignSelf = "center";
          
          const yesBtn = actions.createEl("button", { text: "Yes" });
          yesBtn.style.flex = "1 1 50px";
          yesBtn.style.backgroundColor = "var(--background-modifier-error)";
          yesBtn.style.color = "white";
          yesBtn.onclick = async (ev) => {
            ev.stopPropagation();
            const success = await deleteSnapshotFile(this.plugin, snap.filePath);
            if (success) {
              this.plugin.toast("Version deleted.");
              this.refresh();
            } else {
              this.plugin.toast("Failed to delete version.");
              this.refresh();
            }
          };
          
          const noBtn = actions.createEl("button", { text: "No" });
          noBtn.style.flex = "1 1 50px";
          noBtn.onclick = (ev) => {
            ev.stopPropagation();
            this.refresh();
          };
        };
      }
    }

    if (preRestoreBackup) {
      const divider = wrapper.createEl("hr");
      divider.style.margin = "16px 0 8px 0";
      divider.style.borderTop = "1px dashed var(--background-modifier-border)";

      const backupHeader = wrapper.createEl("h4", { text: "Last Unsaved Version" });
      backupHeader.style.margin = "0 0 8px 0";
      backupHeader.style.color = "var(--text-accent)";

      const backupItem = wrapper.createDiv();
      backupItem.style.padding = "8px";
      backupItem.style.border = "1px solid var(--background-modifier-border)";
      backupItem.style.borderRadius = "4px";
      backupItem.style.backgroundColor = "var(--background-secondary-alt)";
      backupItem.style.display = "flex";
      backupItem.style.flexDirection = "column";
      backupItem.style.gap = "4px";

      const meta = backupItem.createDiv();
      meta.style.fontSize = "0.85em";
      const date = new Date(preRestoreBackup.timestamp);
      meta.textContent = `Auto-saved on restore: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

      const actions = backupItem.createDiv();
      actions.style.display = "flex";
      actions.style.flexWrap = "wrap";
      actions.style.gap = "4px";

      const restoreBtn = actions.createEl("button", { text: "Restore Backup" });
      restoreBtn.style.flex = "1 1 100px";
      restoreBtn.onclick = async () => {
        const curFile = this.plugin.getActiveMarkdownFile();
        if (!curFile) return;

        // 1. Read the backup content FIRST before saving the new pre-restore backup (which deletes the old one)
        const restored = await readSnapshotContent(this.plugin, preRestoreBackup.filePath);
        if (!restored) {
          this.plugin.toast("Failed to load backup.");
          return;
        }
        
        // 2. Auto-save the CURRENT state as a backup (so the user can toggle back and forth!)
        const currentContent = await this.plugin.app.vault.read(curFile);
        await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

        // 3. Restore the backup content
        await this.versioning.restoreFromSnapshot(curFile, restored);
        this.plugin.toast("Backup restored.");
        this.refresh();
      };

      const deleteBtn = actions.createEl("button", { text: "Delete" });
      deleteBtn.style.flex = "1 1 70px";
      deleteBtn.style.color = "var(--text-error)";
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const curFile = this.plugin.getActiveMarkdownFile();
        if (!curFile) return;
        
        actions.empty();
        
        const confirmText = actions.createEl("span", { text: "Delete backup?" });
        confirmText.style.fontSize = "0.85em";
        confirmText.style.color = "var(--text-error)";
        confirmText.style.alignSelf = "center";
        
        const yesBtn = actions.createEl("button", { text: "Yes" });
        yesBtn.style.flex = "1 1 50px";
        yesBtn.style.backgroundColor = "var(--background-modifier-error)";
        yesBtn.style.color = "white";
        yesBtn.onclick = async (ev) => {
          ev.stopPropagation();
          const success = await deleteSnapshotFile(this.plugin, preRestoreBackup.filePath);
          if (success) {
            this.plugin.toast("Backup deleted.");
            this.refresh();
          } else {
            this.plugin.toast("Failed to delete backup.");
            this.refresh();
          }
        };
        
        const noBtn = actions.createEl("button", { text: "No" });
        noBtn.style.flex = "1 1 50px";
        noBtn.onclick = (ev) => {
          ev.stopPropagation();
          this.refresh();
        };
      };
    }
  }

  async refresh() {
    await this.onOpen();
  }
}

class RestoreVersionModal extends Modal {
  private file: TFile;
  private plugin: SaveHistoryPlugin;
  private versioning: any;

  private loadingEl!: HTMLElement;
  private listEl!: HTMLElement;

  private snapshots: any[] = [];

  constructor(plugin: SaveHistoryPlugin, file: TFile, versioning: any) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    this.versioning = versioning;
  }

  async onOpen() {
    const contentEl = (this as any).contentEl as HTMLElement | undefined;

    const root = contentEl ?? document.createElement("div");

    // Clear
    root.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = "Restore version";
    root.appendChild(title);

    this.loadingEl = document.createElement("div");
    this.loadingEl.textContent = "Loading versions…";
    root.appendChild(this.loadingEl);

    this.listEl = document.createElement("div");
    root.appendChild(this.listEl);

    await this.refresh();

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.onclick = () => this.close();
    root.appendChild(closeBtn);

    // ensure root is attached if obsidian didn't attach contentEl
    if (!contentEl) {
      // best-effort: do nothing
    }
  }

  private async refresh() {
    this.loadingEl.textContent = "Loading versions…";

    this.snapshots = await listSnapshotsForFile(this.plugin, this.file.path);

    this.listEl.innerHTML = "";

    if (!this.snapshots.length) {
      const empty = document.createElement("div");
      empty.textContent = "No saved versions yet.";
      this.listEl.appendChild(empty);
      this.loadingEl.textContent = "";
      return;
    }

    for (const snap of this.snapshots) {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexWrap = "wrap";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "8px";
      row.style.margin = "8px 0";
      row.style.paddingBottom = "8px";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";

      const meta = document.createElement("div");
      meta.textContent = snap.timestamp + (snap.reason ? ` (${snap.reason})` : "");
      row.appendChild(meta);

      const btn = document.createElement("button");
      btn.textContent = "Restore";
      btn.onclick = async () => {
        await this.restoreSnapshot(snap);
      };
      row.appendChild(btn);

      this.listEl.appendChild(row);
    }

    this.loadingEl.textContent = "";
  }

  private async restoreSnapshot(snap: any) {
    const restored = await readSnapshotContent(this.plugin, snap.filePath);
    if (!restored) {
      this.plugin.toast("Failed to load selected snapshot.");
      return;
    }

    await this.versioning.restoreFromSnapshot(this.file, restored);
    this.plugin.toast("Version restored.");
    this.close();
  }
}
