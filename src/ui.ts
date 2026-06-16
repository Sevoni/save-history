import { Modal, TFile, ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { SaveHistoryPlugin, type GroupByMode } from "./main";
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

    const headerRow = wrapper.createDiv();
    headerRow.style.display = "flex";
    headerRow.style.alignItems = "center";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.margin = "0 0 8px 0";

    const header = headerRow.createEl("h3", { text: "File History" });
    header.style.margin = "0";

    const groupSelect = headerRow.createEl("select");
    groupSelect.style.fontSize = "0.8em";
    groupSelect.style.padding = "2px 4px";
    groupSelect.style.marginLeft = "8px";
    const opts: { value: GroupByMode; label: string }[] = [
      { value: "none", label: "No grouping" },
      { value: "day", label: "By day" },
      { value: "week", label: "By week" },
    ];
    for (const o of opts) {
      const opt = groupSelect.createEl("option", { text: o.label });
      (opt as HTMLOptionElement).value = o.value;
      if (this.plugin.settings.groupBy === o.value) {
        (opt as HTMLOptionElement).selected = true;
      }
    }
    groupSelect.onchange = async () => {
      this.plugin.settings.groupBy = (groupSelect as HTMLSelectElement).value as GroupByMode;
      await this.plugin.saveSettings();
      this.refresh();
    };

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
      const groupBy = this.plugin.settings.groupBy;

      if (groupBy === "none") {
        for (const snap of snapshots) {
          this.renderSnapshotItem(listContainer, snap, activeFile);
        }
      } else {
        const groups = this.groupSnapshots(snapshots, groupBy);
        for (const group of groups) {
          const groupKey = group.key;
          const isCollapsed = !!this.plugin.settings.collapsedGroups[groupKey];

          const groupEl = listContainer.createDiv();
          groupEl.style.display = "flex";
          groupEl.style.flexDirection = "column";
          groupEl.style.gap = "4px";

          const groupHeader = groupEl.createDiv();
          groupHeader.style.display = "flex";
          groupHeader.style.alignItems = "center";
          groupHeader.style.cursor = "pointer";
          groupHeader.style.padding = "6px 4px";
          groupHeader.style.borderBottom = "1px solid var(--background-modifier-border)";
          groupHeader.style.userSelect = "none";

          const chevron = groupHeader.createEl("span", { text: isCollapsed ? "▸ " : "▾ " });
          chevron.style.fontSize = "0.9em";
          chevron.style.marginRight = "4px";

          const groupTitle = groupHeader.createEl("span");
          groupTitle.style.fontWeight = "600";
          groupTitle.style.fontSize = "0.9em";
          groupTitle.textContent = group.label;

          const count = groupHeader.createEl("span", { text: ` (${group.snapshots.length})` });
          count.style.fontSize = "0.8em";
          count.style.color = "var(--text-muted)";
          count.style.marginLeft = "4px";

          const itemsEl = groupEl.createDiv();
          itemsEl.style.display = "flex";
          itemsEl.style.flexDirection = "column";
          itemsEl.style.gap = "8px";
          itemsEl.style.paddingLeft = "8px";
          itemsEl.style.paddingTop = "4px";
          itemsEl.style.overflow = "hidden";
          if (isCollapsed) {
            itemsEl.style.display = "none";
          }

          groupHeader.onclick = async () => {
            const collapsed = this.plugin.settings.collapsedGroups[groupKey];
            if (collapsed) {
              delete this.plugin.settings.collapsedGroups[groupKey];
              itemsEl.style.display = "flex";
              chevron.textContent = "▾ ";
            } else {
              this.plugin.settings.collapsedGroups[groupKey] = true;
              itemsEl.style.display = "none";
              chevron.textContent = "▸ ";
            }
            await this.plugin.saveSettings();
          };

          for (const snap of group.snapshots) {
            this.renderSnapshotItem(itemsEl, snap, activeFile);
          }
        }
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

        const restored = await readSnapshotContent(this.plugin, preRestoreBackup.filePath);
        if (!restored) {
          this.plugin.toast("Failed to load backup.");
          return;
        }
        
        const currentContent = await this.plugin.app.vault.read(curFile);
        await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

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

  private groupSnapshots(
    snapshots: (SnapshotRecord & { filePath: string })[],
    groupBy: GroupByMode
  ): { key: string; label: string; snapshots: (SnapshotRecord & { filePath: string })[] }[] {
    const groups = new Map<string, { key: string; label: string; snapshots: (SnapshotRecord & { filePath: string })[] }>();

    for (const snap of snapshots) {
      const date = new Date(snap.timestamp);
      let key: string;
      let label: string;

      if (groupBy === "day") {
        key = date.toISOString().slice(0, 10);
        label = date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      } else {
        const weekStart = this.getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        key = weekStart.toISOString().slice(0, 10);
        const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const endLabel = weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        label = `${startLabel} – ${endLabel}`;
      }

      if (!groups.has(key)) {
        groups.set(key, { key, label, snapshots: [] });
      }
      groups.get(key)!.snapshots.push(snap);
    }

    return Array.from(groups.values());
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }

  private renderSnapshotItem(
    parent: HTMLElement,
    snap: SnapshotRecord & { filePath: string },
    activeFile: TFile
  ) {
    const item = parent.createDiv();
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
    meta.style.flexDirection = "column";
    meta.style.gap = "2px";

    const renderNormalState = () => {
      meta.empty();
      
      const nameRow = meta.createDiv();
      nameRow.style.display = "flex";
      nameRow.style.alignItems = "center";
      nameRow.style.justifyContent = "space-between";

      const label = nameRow.createEl("span");
      label.style.fontWeight = "500";
      label.textContent = snap.reason;

      const editBtn = nameRow.createEl("span", { text: "✏️" });
      editBtn.style.cursor = "pointer";
      editBtn.style.marginLeft = "6px";
      editBtn.title = "Rename version";
      editBtn.onclick = (e) => {
        e.stopPropagation();
        renderEditState();
      };

      const timeRow = meta.createDiv();
      timeRow.style.fontSize = "0.8em";
      timeRow.style.color = "var(--text-muted)";
      const groupBy = this.plugin.settings.groupBy;
      if (groupBy === "day") {
        timeRow.textContent = date.toLocaleTimeString();
      } else {
        timeRow.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }
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
      
      const previewModal = new Modal(this.plugin.app);
      previewModal.onOpen = () => {
        const el = previewModal.contentEl;
        el.empty();

        const modalContainer = (previewModal as any).modalEl as HTMLElement;
        if (modalContainer) {
          modalContainer.style.width = "800px";
          modalContainer.style.height = "70vh";
          modalContainer.style.minWidth = "320px";
          modalContainer.style.minHeight = "200px";
          modalContainer.style.position = "relative";
          modalContainer.style.display = "flex";
          modalContainer.style.flexDirection = "column";
          modalContainer.style.overflow = "hidden";
        }

        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.style.flex = "1";
        el.style.overflow = "hidden";

        const titleEl = el.createEl("h2");
        titleEl.textContent = snap.reason;
        titleEl.style.marginBottom = "2px";
        titleEl.style.cursor = "move";
        titleEl.style.userSelect = "none";
        titleEl.style.flexShrink = "0";

        const timeEl = el.createDiv();
        timeEl.style.fontSize = "0.85em";
        timeEl.style.color = "var(--text-muted)";
        timeEl.style.marginBottom = "12px";
        timeEl.style.flexShrink = "0";
        timeEl.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        const content = el.createDiv();
        content.style.flex = "1";
        content.style.overflowY = "auto";
        content.style.padding = "10px";
        content.style.border = "1px solid var(--background-modifier-border)";
        content.style.borderRadius = "4px";
        content.style.backgroundColor = "var(--background-primary)";
        content.classList.add("markdown-preview-view");

        MarkdownRenderer.render(this.plugin.app, restored.content, content, curFile.path, previewModal);
        
        const btnRow = el.createDiv();
        btnRow.style.marginTop = "12px";
        btnRow.style.display = "flex";
        btnRow.style.gap = "8px";
        btnRow.style.flexShrink = "0";
        
        const rst = btnRow.createEl("button", { text: "Restore This Version" });
        rst.onclick = async () => {
          const currentContent = await this.plugin.app.vault.read(curFile);
          await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

          await this.versioning.restoreFromSnapshot(curFile, restored);
          this.plugin.toast("Version restored. Current state backed up below.");
          previewModal.close();
          this.refresh();
        };
        
        const cls = btnRow.createEl("button", { text: "Close" });
        cls.onclick = () => previewModal.close();

        if (modalContainer) {
          makeDraggable(modalContainer, titleEl);
          makeResizable(modalContainer);
        }
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
      meta.style.display = "flex";
      meta.style.flexDirection = "column";
      meta.style.gap = "2px";

      const nameLabel = document.createElement("span");
      nameLabel.style.fontWeight = "500";
      nameLabel.textContent = snap.reason || "(unnamed)";
      meta.appendChild(nameLabel);

      const timeLabel = document.createElement("span");
      timeLabel.style.fontSize = "0.8em";
      timeLabel.style.color = "var(--text-muted)";
      const d = new Date(snap.timestamp);
      timeLabel.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
      meta.appendChild(timeLabel);

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

function makeDraggable(el: HTMLElement, handle: HTMLElement) {
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;
  let dragging = false;

  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).tagName === "INPUT") return;
    e.preventDefault();
    dragging = true;

    const rect = el.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;

    const parentStyle = (el.parentElement as HTMLElement)?.style;
    if (parentStyle) {
      parentStyle.display = "flex";
      parentStyle.justifyContent = "flex-start";
      parentStyle.alignItems = "flex-start";
    }

    el.style.position = "fixed";
    el.style.left = origLeft + "px";
    el.style.top = origTop + "px";
    el.style.margin = "0";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = (origLeft + dx) + "px";
    el.style.top = (origTop + dy) + "px";
  };

  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  handle.addEventListener("mousedown", onMouseDown);
}

function makeResizable(el: HTMLElement) {
  const EDGE = 8;

  const resizer = el.createDiv();
  resizer.style.position = "absolute";
  resizer.style.right = "0";
  resizer.style.bottom = "0";
  resizer.style.width = "16px";
  resizer.style.height = "16px";
  resizer.style.cursor = "nwse-resize";
  resizer.style.zIndex = "10";

  const resizerLine1 = resizer.createDiv();
  resizerLine1.style.position = "absolute";
  resizerLine1.style.right = "3px";
  resizerLine1.style.bottom = "5px";
  resizerLine1.style.width = "10px";
  resizerLine1.style.height = "1px";
  resizerLine1.style.backgroundColor = "var(--text-faint)";
  resizerLine1.style.transform = "rotate(-45deg)";
  resizerLine1.style.transformOrigin = "right center";

  const resizerLine2 = resizer.createDiv();
  resizerLine2.style.position = "absolute";
  resizerLine2.style.right = "3px";
  resizerLine2.style.bottom = "9px";
  resizerLine2.style.width = "6px";
  resizerLine2.style.height = "1px";
  resizerLine2.style.backgroundColor = "var(--text-faint)";
  resizerLine2.style.transform = "rotate(-45deg)";
  resizerLine2.style.transformOrigin = "right center";

  let resizing = false;
  let startX = 0, startY = 0, origW = 0, origH = 0;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    origW = el.offsetWidth;
    origH = el.offsetHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizing) return;
      const newW = Math.max(320, origW + (ev.clientX - startX));
      const newH = Math.max(200, origH + (ev.clientY - startY));
      el.style.width = newW + "px";
      el.style.height = newH + "px";
    };

    const onMouseUp = () => {
      resizing = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}
