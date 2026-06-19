import { Modal, TFile, ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { SaveHistoryPlugin, type GroupByMode } from "./main";
import { listSnapshotsForFile, readSnapshotContent, deleteSnapshotFile, updateSnapshotLabel, savePreRestoreBackup } from "./storage";
import type { SnapshotRecord } from "./storage";
import { computeDiff, type DiffLine } from "./diff";
import { translate } from "./locale";

async function resolveImagesInMarkdown(plugin: SaveHistoryPlugin, markdown: string, sourcePath: string): Promise<string> {
  const adapter = plugin.app.vault.adapter;
  const parentFolder = sourcePath.includes("/") ? sourcePath.substring(0, sourcePath.lastIndexOf("/")) : "";

  const wikiImageRegex = /!\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  let result = markdown;

  const matches: { full: string; path: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = wikiImageRegex.exec(markdown)) !== null) {
    matches.push({ full: m[0], path: m[1].trim() });
  }
  while ((m = mdImageRegex.exec(markdown)) !== null) {
    matches.push({ full: m[0], path: m[2].trim() });
  }

  for (const match of matches) {
    const imgPath = match.path.startsWith("/") ? match.path.substring(1) : (parentFolder ? `${parentFolder}/${match.path}` : match.path);

    try {
      if (await adapter.exists(imgPath)) {
        const data = await adapter.read(imgPath);
        const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
          : ext === "gif" ? "image/gif"
          : ext === "svg" ? "image/svg+xml"
          : ext === "webp" ? "image/webp"
          : "image/png";
        const dataUrl = `data:${mime};base64,${btoa(unescape(encodeURIComponent(data)))}`;
        result = result.split(match.full).join(`![image](${dataUrl})`);
      }
    } catch {
      // skip unresolvable images
    }
  }

  return result;
}

export const VIEW_TYPE_SAVE_HISTORY = "save-history-view";

export function registerCommands(plugin: SaveHistoryPlugin, versioning: any) {
  plugin.addCommand?.({
    id: "save-history:save-now",
    name: translate("cmdSaveNow"),
    callback: async () => {
      const file = plugin.getActiveFile();
      if (!file) {
        plugin.toast(translate("noFileOpenSave"));
        return;
      }
      const result = await versioning.saveNowForFile(file, "manual");
      plugin.toast(result === "saved" ? translate("versionSaved") : translate("noChangesDetected"));
      
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
    name: translate("cmdRestore"),
    callback: async () => {
      const file = plugin.getActiveFile();
      if (!file) {
        plugin.toast(translate("noFileOpenRestore"));
        return;
      }
      new RestoreVersionModal(plugin, file, versioning).open();
    },
  } as any);

  plugin.addCommand?.({
    id: "save-history:open-sidebar",
    name: translate("cmdOpenSidebar"),
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

  plugin.addCommand?.({
    id: "save-history:restore-last-backup",
    name: translate("cmdRestoreLastBackup"),
    callback: async () => {
      const file = plugin.getActiveFile();
      if (!file) {
        plugin.toast(translate("noFileOpenRestore"));
        return;
      }
      const allSnapshots = await listSnapshotsForFile(plugin, file.path);
      const preRestoreBackup = allSnapshots.find(s => s.reason === "pre-restore");
      if (!preRestoreBackup) {
        plugin.toast(translate("noSavedVersions"));
        return;
      }
      const restored = await readSnapshotContent(plugin, preRestoreBackup.filePath);
      if (!restored) {
        plugin.toast(translate("failedLoadBackup"));
        return;
      }
      const currentContent = await plugin.app.vault.read(file);
      await savePreRestoreBackup(plugin, file.path, currentContent);
      await versioning.restoreFromSnapshot(file, restored);
      plugin.toast(translate("backupRestored"));

      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
      for (const leaf of leaves) {
        if (leaf.view instanceof SaveHistoryView) {
          leaf.view.refresh();
        }
      }
    },
  } as any);
}

export class SaveHistoryView extends ItemView {
  private plugin: SaveHistoryPlugin;
  private versioning: any;
  private container: HTMLElement;
  private diffMode: boolean = false;
  private diffSelection: (SnapshotRecord & { filePath: string })[] = [];

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
    return translate("viewTitle");
  }

  getIcon(): string {
    return "history";
  }

  async onOpen() {
    this.cleanupDropdowns();
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

    const header = headerRow.createEl("h3", { text: translate("viewTitle") });
    header.style.margin = "0";

    const groupSelect = headerRow.createEl("select");
    groupSelect.style.fontSize = "0.8em";
    groupSelect.style.padding = "2px 4px";
    groupSelect.style.marginLeft = "8px";
    const opts: { value: GroupByMode; label: string }[] = [
      { value: "none", label: translate("groupNone") },
      { value: "day", label: translate("groupDay") },
      { value: "week", label: translate("groupWeek") },
      { value: "month", label: translate("groupMonth") },
      { value: "year", label: translate("groupYear") },
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

    const activeFile = this.plugin.getActiveFile();
    if (!activeFile) {
      wrapper.createDiv({ text: translate("noActiveFile"), cls: "nav-header" });
      return;
    }

    const fileLabel = wrapper.createDiv();
    fileLabel.style.fontSize = "0.85em";
    fileLabel.style.color = "var(--text-muted)";
    fileLabel.style.marginBottom = "8px";
    fileLabel.textContent = translate("fileLabel", { name: activeFile.name });

    const saveBtn = wrapper.createEl("button", { text: translate("saveVersionNow") });
    saveBtn.style.width = "100%";
    saveBtn.onclick = async () => {
      const curFile = this.plugin.getActiveFile();
      if (!curFile) return;
      const result = await this.versioning.saveNowForFile(curFile, "manual");
      this.plugin.toast(result === "saved" ? translate("versionSaved") : translate("noChangesDetected"));
      this.refresh();
    };

    const diffBtnRow = wrapper.createDiv();
    diffBtnRow.style.display = "flex";
    diffBtnRow.style.flexWrap = "wrap";
    diffBtnRow.style.gap = "6px";

    const diffToggleBtn = diffBtnRow.createEl("button", { text: this.diffMode ? translate("cancelDiff") : translate("diffTwoVersions") });
    diffToggleBtn.style.flex = "1 1 100px";
    diffToggleBtn.onclick = () => {
      this.diffMode = !this.diffMode;
      this.diffSelection = [];
      this.refresh();
    };

    if (this.diffMode && this.diffSelection.length === 2) {
      const diffGoBtn = diffBtnRow.createEl("button", { text: translate("showDiff") });
      diffGoBtn.style.flex = "1 1 100px";
      diffGoBtn.style.fontWeight = "600";
      diffGoBtn.onclick = async () => {
        const recOld = await readSnapshotContent(this.plugin, this.diffSelection[1].filePath);
        const recNew = await readSnapshotContent(this.plugin, this.diffSelection[0].filePath);
        if (!recOld || !recNew) {
          this.plugin.toast(translate("failedLoadSnapshotContent"));
          return;
        }
        new DiffModal(this.plugin, this.diffSelection[1], this.diffSelection[0], recOld.content, recNew.content).open();
        this.diffMode = false;
        this.diffSelection = [];
        this.refresh();
      };
    }

    const listContainer = wrapper.createDiv();
    listContainer.style.display = "flex";
    listContainer.style.flexDirection = "column";
    listContainer.style.gap = "8px";

    const allSnapshots = await listSnapshotsForFile(this.plugin, activeFile.path);
    const snapshots = allSnapshots.filter(s => s.reason !== "pre-restore");
    const preRestoreBackup = allSnapshots.find(s => s.reason === "pre-restore");

    if (snapshots.length === 0) {
      listContainer.createDiv({ text: translate("noSavedVersions") });
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

      const backupHeader = wrapper.createEl("h4", { text: translate("lastUnsavedVersion") });
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
      meta.textContent = translate("autoSavedOnRestore", { date: date.toLocaleDateString(), time: date.toLocaleTimeString() });

      const actions = backupItem.createDiv();
      actions.style.display = "flex";
      actions.style.flexWrap = "wrap";
      actions.style.gap = "4px";

      const restoreBtn = actions.createEl("button", { text: translate("restoreBackup") });
      restoreBtn.style.flex = "1 1 100px";
      restoreBtn.onclick = async () => {
        const curFile = this.plugin.getActiveFile();
        if (!curFile) return;

        const restored = await readSnapshotContent(this.plugin, preRestoreBackup.filePath);
        if (!restored) {
          this.plugin.toast(translate("failedLoadBackup"));
          return;
        }
        
        const currentContent = await this.plugin.app.vault.read(curFile);
        await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

        await this.versioning.restoreFromSnapshot(curFile, restored);
        this.plugin.toast(translate("backupRestored"));
        this.refresh();
      };

      const deleteBtn = actions.createEl("button", { text: translate("delete") });
      deleteBtn.style.flex = "1 1 70px";
      deleteBtn.style.color = "var(--text-error)";
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const curFile = this.plugin.getActiveFile();
        if (!curFile) return;
        
        actions.empty();
        
        const confirmText = actions.createEl("span", { text: translate("deleteBackup") });
        confirmText.style.fontSize = "0.85em";
        confirmText.style.color = "var(--text-error)";
        confirmText.style.alignSelf = "center";
        
        const yesBtn = actions.createEl("button", { text: translate("yes") });
        yesBtn.style.flex = "1 1 50px";
        yesBtn.style.backgroundColor = "var(--background-modifier-error)";
        yesBtn.style.color = "white";
        yesBtn.onclick = async (ev) => {
          ev.stopPropagation();
          const success = await deleteSnapshotFile(this.plugin, preRestoreBackup.filePath);
          if (success) {
            this.plugin.toast(translate("backupDeleted"));
            this.refresh();
          } else {
            this.plugin.toast(translate("failedDeleteBackup"));
            this.refresh();
          }
        };
        
        const noBtn = actions.createEl("button", { text: translate("no") });
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
      } else if (groupBy === "week") {
        const weekStart = this.getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        key = weekStart.toISOString().slice(0, 10);
        const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const endLabel = weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        label = `${startLabel} – ${endLabel}`;
      } else if (groupBy === "month") {
        key = date.toISOString().slice(0, 7);
        label = date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
      } else {
        key = date.toISOString().slice(0, 4);
        label = date.toLocaleDateString(undefined, { year: "numeric" });
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
    item.style.position = "relative";

    const isSelected = this.diffSelection.some(s => s.filePath === snap.filePath);
    if (isSelected) {
      item.style.backgroundColor = "var(--interactive-accent)";
      item.style.color = "var(--text-on-accent)";
    }

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

      let selectionLabel: string | null = null;
      if (this.diffMode) {
        const idx = this.diffSelection.findIndex(s => s.filePath === snap.filePath);
        if (idx === 0) selectionLabel = translate("diffNewer");
        else if (idx === 1) selectionLabel = translate("diffOlder");
      }

      const label = nameRow.createEl("span");
      label.style.fontWeight = "500";
      label.textContent = snap.reason;

      if (selectionLabel) {
        const selSpan = nameRow.createEl("span", { text: ` [${selectionLabel}]` });
        selSpan.style.fontSize = "0.8em";
        selSpan.style.fontWeight = "700";
      }

      if (!this.diffMode) {
        const dotsBtn = nameRow.createEl("span", { text: "⋮" });
        dotsBtn.style.cursor = "pointer";
        dotsBtn.style.marginLeft = "6px";
        dotsBtn.style.fontSize = "1.2em";
        dotsBtn.style.lineHeight = "1";
        dotsBtn.style.padding = "4px 6px";
        dotsBtn.style.borderRadius = "4px";
        dotsBtn.style.userSelect = "none";
        dotsBtn.title = translate("moreActions");

        const dropdown = document.createElement("div");
        dropdown.dataset.saveHistoryDropdown = "";
        dropdown.style.position = "fixed";
        dropdown.style.zIndex = "9999";
        dropdown.style.backgroundColor = "var(--background-primary)";
        dropdown.style.border = "1px solid var(--background-modifier-border)";
        dropdown.style.borderRadius = "6px";
        dropdown.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
        dropdown.style.minWidth = "160px";
        dropdown.style.padding = "4px 0";
        dropdown.style.display = "none";

        const addMenuItem = (text: string, onClick: () => void) => {
          const menuItem = dropdown.createDiv({ text });
          menuItem.style.padding = "6px 12px";
          menuItem.style.cursor = "pointer";
          menuItem.style.fontSize = "0.9em";
          menuItem.style.whiteSpace = "nowrap";
          menuItem.onmouseover = () => {
            menuItem.style.backgroundColor = "var(--background-modifier-hover)";
          };
          menuItem.onmouseout = () => {
            menuItem.style.backgroundColor = "transparent";
          };
          menuItem.addEventListener("click", (e) => {
            e.stopPropagation();
            closeDropdown();
            onClick();
          });
        };

        const closeDropdown = () => {
          dropdown.style.display = "none";
          document.removeEventListener("mousedown", onOutsideMouseDown, true);
        };

        const onOutsideMouseDown = (e: MouseEvent) => {
          if (!dropdown.contains(e.target as Node) && !dotsBtn.contains(e.target as Node)) {
            closeDropdown();
          }
        };

        const openDropdown = () => {
          const rect = dotsBtn.getBoundingClientRect();
          const vpW = window.innerWidth;
          const vpH = window.innerHeight;
          dropdown.style.display = "block";
          const ddW = dropdown.offsetWidth;
          const ddH = dropdown.offsetHeight;
          let top = rect.bottom + 4;
          let left = rect.left;
          if (left + ddW > vpW - 8) left = vpW - ddW - 8;
          if (left < 8) left = 8;
          if (top + ddH > vpH - 8) top = rect.top - ddH - 4;
          if (top < 8) top = 8;
          dropdown.style.top = top + "px";
          dropdown.style.left = left + "px";
          document.addEventListener("mousedown", onOutsideMouseDown, true);
        };

        addMenuItem(translate("renameVersion"), () => renderEditState());

        addMenuItem(translate("diffWithCurrent"), async () => {
          const curFile = this.plugin.getActiveFile();
          if (!curFile) return;
          const snapContent = await readSnapshotContent(this.plugin, snap.filePath);
          if (!snapContent) {
            this.plugin.toast(translate("failedLoadSnapshot"));
            return;
          }
          const currentContent = await this.plugin.app.vault.read(curFile);
          const currentSnap: SnapshotRecord & { filePath: string } = {
            timestamp: new Date().toISOString(),
            reason: translate("currentFile"),
            filePath: curFile.path,
          };
          new DiffModal(this.plugin, snap, currentSnap, snapContent.content, currentContent).open();
        });

        addMenuItem(translate("delete"), async () => {
          closeDropdown();
          showDeleteConfirm();
        });

        document.body.appendChild(dropdown);

        dotsBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropdown.style.display === "block") {
            closeDropdown();
          } else {
            openDropdown();
          }
        });
      }

      const timeRow = meta.createDiv();
      timeRow.style.fontSize = "0.8em";
      timeRow.style.color = isSelected ? "var(--text-on-accent)" : "var(--text-muted)";
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
          this.plugin.toast(translate("labelUpdated"));
          this.refresh();
        } else {
          this.plugin.toast(translate("failedUpdateLabel"));
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

      const okBtn = controls.createEl("span", { text: "\u2714\ufe0f" });
      okBtn.style.cursor = "pointer";
      okBtn.title = translate("save");
      okBtn.onclick = async (ev) => {
        ev.stopPropagation();
        await saveLabel();
      };

      const cancelBtn = controls.createEl("span", { text: "\u274c" });
      cancelBtn.style.cursor = "pointer";
      cancelBtn.title = translate("cancel");
      cancelBtn.onclick = (ev) => {
        ev.stopPropagation();
        renderNormalState();
      };

      setTimeout(() => input.focus(), 50);
    };

    renderNormalState();

    if (this.diffMode) {
      const diffSelectBtn = item.createEl("button", {
        text: isSelected
          ? translate("deselect")
          : this.diffSelection.length < 2
          ? translate("selectForDiff")
          : translate("replaceSelection")
      });
      diffSelectBtn.style.width = "100%";
      diffSelectBtn.style.fontSize = "0.85em";
      diffSelectBtn.onclick = (e) => {
        e.stopPropagation();
        if (isSelected) {
          this.diffSelection = this.diffSelection.filter(s => s.filePath !== snap.filePath);
        } else if (this.diffSelection.length < 2) {
          this.diffSelection.push(snap);
        } else {
          this.diffSelection[1] = snap;
        }
        this.refresh();
      };
      return;
    }

    const actions = item.createDiv();
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "4px";

    const showDeleteConfirm = () => {
      actions.empty();
      const confirmText = actions.createEl("span", { text: translate("deleteConfirm") });
      confirmText.style.fontSize = "0.85em";
      confirmText.style.color = "var(--text-error)";
      confirmText.style.alignSelf = "center";

      const yesBtn = actions.createEl("button", { text: translate("yes") });
      yesBtn.style.flex = "1 1 50px";
      yesBtn.style.backgroundColor = "var(--background-modifier-error)";
      yesBtn.style.color = "white";
      yesBtn.onclick = async (ev) => {
        ev.stopPropagation();
        const success = await deleteSnapshotFile(this.plugin, snap.filePath);
        if (success) {
          this.plugin.toast(translate("versionDeleted"));
          this.refresh();
        } else {
          this.plugin.toast(translate("failedDeleteVersion"));
          this.refresh();
        }
      };

      const noBtn = actions.createEl("button", { text: translate("no") });
      noBtn.style.flex = "1 1 50px";
      noBtn.onclick = (ev) => {
        ev.stopPropagation();
        this.refresh();
      };
    };

    const restoreBtn = actions.createEl("button", { text: translate("restore") });
    restoreBtn.style.flex = "1 1 70px";
    restoreBtn.onclick = async () => {
      const curFile = this.plugin.getActiveFile();
      if (!curFile) return;

      const currentContent = await this.plugin.app.vault.read(curFile);
      await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

      const restored = await readSnapshotContent(this.plugin, snap.filePath);
      if (!restored) {
        this.plugin.toast(translate("failedLoadSnapshotDot"));
        return;
      }
      await this.versioning.restoreFromSnapshot(curFile, restored);
      this.plugin.toast(translate("versionRestored"));
      this.refresh();
    };

    const previewBtn = actions.createEl("button", { text: translate("preview") });
    previewBtn.style.flex = "1 1 70px";
    previewBtn.onclick = async () => {
      const curFile = this.plugin.getActiveFile();
      if (!curFile) return;
      const restored = await readSnapshotContent(this.plugin, snap.filePath);
      if (!restored) return;
      
      const previewModal = new Modal(this.plugin.app);
      const previewAbort = new AbortController();
      previewModal.onOpen = async () => {
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

        const imgStyle = document.createElement("style");
        imgStyle.textContent = `
          .sh-preview-content img { max-width: 100%; height: auto; }
          .sh-preview-content svg { max-width: 100%; }
        `;
        content.appendChild(imgStyle);
        content.classList.add("sh-preview-content");

        const resolvedContent = await resolveImagesInMarkdown(this.plugin, restored.content, curFile.path);
        if (curFile.extension === "md") {
          await MarkdownRenderer.render(this.plugin.app, resolvedContent, content, curFile.path, this.plugin);
        } else {
          const pre = content.createEl("pre");
          pre.style.margin = "0";
          pre.style.whiteSpace = "pre-wrap";
          pre.style.wordBreak = "break-word";
          pre.style.fontFamily = "var(--font-monospace)";
          pre.style.fontSize = "0.9em";
          pre.textContent = resolvedContent;
        }
        
        const btnRow = el.createDiv();
        btnRow.style.marginTop = "12px";
        btnRow.style.display = "flex";
        btnRow.style.gap = "8px";
        btnRow.style.flexShrink = "0";
        
        const rst = btnRow.createEl("button", { text: translate("restoreThisVersion") });
        rst.onclick = async () => {
          const currentContent = await this.plugin.app.vault.read(curFile);
          await savePreRestoreBackup(this.plugin, curFile.path, currentContent);

          await this.versioning.restoreFromSnapshot(curFile, restored);
      this.plugin.toast(translate("versionRestored"));
          previewModal.close();
          this.refresh();
        };
        
        const cls = btnRow.createEl("button", { text: translate("close") });
        cls.onclick = () => previewModal.close();

        if (modalContainer) {
          makeDraggable(modalContainer, titleEl, previewAbort.signal);
          makeResizable(modalContainer, previewAbort.signal);
        }
      };
      previewModal.onClose = () => previewAbort.abort();
      previewModal.open();
    };

  }

  async refresh() {
    await this.onOpen();
  }

  async onClose() {
    this.cleanupDropdowns();
  }

  private cleanupDropdowns() {
    document.querySelectorAll("[data-save-history-dropdown]").forEach(el => el.remove());
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

    root.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = translate("restoreVersion");
    root.appendChild(title);

    this.loadingEl = document.createElement("div");
    this.loadingEl.textContent = translate("loadingVersions");
    root.appendChild(this.loadingEl);

    this.listEl = document.createElement("div");
    root.appendChild(this.listEl);

    await this.refresh();

    const closeBtn = document.createElement("button");
    closeBtn.textContent = translate("close");
    closeBtn.onclick = () => this.close();
    root.appendChild(closeBtn);
  }

  private async refresh() {
    this.loadingEl.textContent = translate("loadingVersions");

    this.snapshots = await listSnapshotsForFile(this.plugin, this.file.path);

    this.listEl.innerHTML = "";

    if (!this.snapshots.length) {
      const empty = document.createElement("div");
      empty.textContent = translate("noSavedVersionsYet");
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
      nameLabel.textContent = snap.reason || translate("unnamed");
      meta.appendChild(nameLabel);

      const timeLabel = document.createElement("span");
      timeLabel.style.fontSize = "0.8em";
      timeLabel.style.color = "var(--text-muted)";
      const d = new Date(snap.timestamp);
      timeLabel.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
      meta.appendChild(timeLabel);

      row.appendChild(meta);

      const btn = document.createElement("button");
      btn.textContent = translate("restore");
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
      this.plugin.toast(translate("failedLoadSnapshotDot"));
      return;
    }

    await this.versioning.restoreFromSnapshot(this.file, restored);
    this.plugin.toast(translate("versionRestoredDot"));
    this.close();
  }
}

class DiffModal extends Modal {
  private plugin: SaveHistoryPlugin;
  private snapOld: SnapshotRecord & { filePath: string };
  private snapNew: SnapshotRecord & { filePath: string };
  private contentOld: string;
  private contentNew: string;
  private abortController: AbortController;

  constructor(
    plugin: SaveHistoryPlugin,
    snapOld: SnapshotRecord & { filePath: string },
    snapNew: SnapshotRecord & { filePath: string },
    contentOld: string,
    contentNew: string
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.snapOld = snapOld;
    this.snapNew = snapNew;
    this.contentOld = contentOld;
    this.contentNew = contentNew;
    this.abortController = new AbortController();
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();

    const modalContainer = (this as any).modalEl as HTMLElement;
    if (modalContainer) {
      modalContainer.style.width = "900px";
      modalContainer.style.height = "80vh";
      modalContainer.style.minWidth = "400px";
      modalContainer.style.minHeight = "300px";
      modalContainer.style.position = "relative";
      modalContainer.style.display = "flex";
      modalContainer.style.flexDirection = "column";
      modalContainer.style.overflow = "hidden";
    }

    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.flex = "1";
    el.style.overflow = "hidden";

    const titleEl = el.createEl("h2", { text: translate("diff") });
    titleEl.style.marginBottom = "2px";
    titleEl.style.flexShrink = "0";
    titleEl.style.cursor = "move";
    titleEl.style.userSelect = "none";

    const oldDate = new Date(this.snapOld.timestamp);
    const newDate = new Date(this.snapNew.timestamp);

    const infoRow = el.createDiv();
    infoRow.style.display = "flex";
    infoRow.style.alignItems = "center";
    infoRow.style.gap = "12px";
    infoRow.style.marginBottom = "8px";
    infoRow.style.flexShrink = "0";
    infoRow.style.fontSize = "0.85em";

    const oldTag = infoRow.createEl("span");
    oldTag.style.padding = "2px 8px";
    oldTag.style.borderRadius = "4px";
    oldTag.style.backgroundColor = "rgba(248, 81, 73, 0.15)";
    oldTag.style.border = "1px solid rgba(248, 81, 73, 0.4)";
    oldTag.style.color = "var(--text-muted)";
    oldTag.textContent = `${this.snapOld.reason} — ${oldDate.toLocaleDateString()} ${oldDate.toLocaleTimeString()}`;

    const arrow = infoRow.createEl("span", { text: "→" });
    arrow.style.fontSize = "1.2em";
    arrow.style.color = "var(--text-muted)";

    const newTag = infoRow.createEl("span");
    newTag.style.padding = "2px 8px";
    newTag.style.borderRadius = "4px";
    newTag.style.backgroundColor = "rgba(46, 160, 67, 0.15)";
    newTag.style.border = "1px solid rgba(46, 160, 67, 0.4)";
    newTag.style.color = "var(--text-muted)";
    newTag.textContent = `${this.snapNew.reason} — ${newDate.toLocaleDateString()} ${newDate.toLocaleTimeString()}`;

    const diff = computeDiff(this.contentOld, this.contentNew);
    const added = diff.filter(l => l.type === "add").length;
    const removed = diff.filter(l => l.type === "remove").length;

    const stats = el.createDiv();
    stats.style.fontSize = "0.8em";
    stats.style.color = "var(--text-muted)";
    stats.style.marginBottom = "8px";
    stats.style.flexShrink = "0";
    if (added === 0 && removed === 0) {
      stats.textContent = translate("noDifferences");
    } else {
      const sAdd = stats.createEl("span", { text: translate("added", { n: added }) });
      sAdd.style.color = "#2ea043";
      stats.createEl("span", { text: "  " });
      const sRem = stats.createEl("span", { text: translate("removed", { n: removed }) });
      sRem.style.color = "#f85149";
    }

    const diffContainer = el.createDiv();
    diffContainer.style.flex = "1";
    diffContainer.style.overflowY = "auto";
    diffContainer.style.border = "1px solid var(--background-modifier-border)";
    diffContainer.style.borderRadius = "6px";
    diffContainer.style.backgroundColor = "var(--background-primary)";

    if (!document.getElementById("save-history-diff-styles")) {
      const style = document.createElement("style");
      style.id = "save-history-diff-styles";
      style.textContent = `
        .sh-diff-row {
          display: flex;
          align-items: stretch;
          min-height: 1.8em;
          font-size: 0.85em;
          line-height: 1.6;
          border-bottom: 1px solid transparent;
        }
        .sh-diff-row-num {
          width: 3.5em;
          min-width: 3.5em;
          max-width: 3.5em;
          text-align: right;
          padding: 2px 6px 2px 0;
          color: var(--text-faint);
          user-select: none;
          font-family: var(--font-monospace);
          font-size: 0.9em;
          flex-shrink: 0;
          border-right: 1px solid var(--background-modifier-border);
        }
        .sh-diff-row-prefix {
          width: 1.8em;
          min-width: 1.8em;
          max-width: 1.8em;
          text-align: center;
          font-weight: 700;
          font-family: var(--font-monospace);
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sh-diff-row-text {
          flex: 1;
          padding: 2px 8px;
          overflow: hidden;
          min-width: 0;
        }
        .sh-diff-row-text > *:first-child { margin-top: 0; }
        .sh-diff-row-text > *:last-child { margin-bottom: 0; }
        .sh-diff-row-add {
          background: rgba(46, 160, 67, 0.10);
        }
        .sh-diff-row-add .sh-diff-row-prefix { color: #2ea043; }
        .sh-diff-row-remove {
          background: rgba(248, 81, 73, 0.10);
        }
        .sh-diff-row-remove .sh-diff-row-prefix { color: #f85149; }
        .sh-diff-row-equal {
          background: transparent;
        }
        .sh-diff-row-equal .sh-diff-row-text { color: var(--text-muted); }
        .sh-diff-collapse {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          background: var(--background-secondary);
          border-top: 1px solid var(--background-modifier-border);
          border-bottom: 1px solid var(--background-modifier-border);
          color: var(--text-faint);
          font-size: 0.8em;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s, color 0.15s;
        }
        .sh-diff-collapse:hover {
          background: var(--background-modifier-hover);
          color: var(--text-muted);
        }
        .sh-diff-hidden { display: none; }
      `;
      document.head.appendChild(style);
    }

    const curFile = this.plugin.getActiveFile();
    const sourcePath = curFile?.path ?? "";
    const app = this.plugin.app;
    const plugin = this.plugin;
    const COLLAPSE = 4;

    const renderRows = async () => {
      let eqRun: DiffLine[] = [];

      const flushEq = async () => {
        if (eqRun.length === 0) return;
        if (eqRun.length > COLLAPSE * 2) {
          for (const line of eqRun.slice(0, COLLAPSE)) {
            await appendDiffRow(diffContainer, app, line, sourcePath, plugin);
          }
          const hidden = eqRun.slice(COLLAPSE, eqRun.length - COLLAPSE);
          const bar = diffContainer.createDiv();
          bar.className = "sh-diff-collapse";
              bar.textContent = translate("unchangedLinesShow", { n: hidden.length });
          const hiddenEl = diffContainer.createDiv();
          hiddenEl.className = "sh-diff-hidden";
          for (const line of hidden) {
            await appendDiffRow(hiddenEl, app, line, sourcePath, plugin);
          }
          let expanded = false;
          bar.onclick = () => {
            expanded = !expanded;
            if (expanded) {
              hiddenEl.classList.remove("sh-diff-hidden");
              bar.textContent = translate("unchangedLinesHide", { n: hidden.length });
            } else {
              hiddenEl.classList.add("sh-diff-hidden");
          bar.textContent = translate("unchangedLinesShow", { n: hidden.length });
            }
          };
          for (const line of eqRun.slice(eqRun.length - COLLAPSE)) {
            await appendDiffRow(diffContainer, app, line, sourcePath, plugin);
          }
        } else {
          for (const line of eqRun) {
            await appendDiffRow(diffContainer, app, line, sourcePath, plugin);
          }
        }
        eqRun = [];
      };

      for (const line of diff) {
        if (line.type === "equal") {
          eqRun.push(line);
        } else {
          await flushEq();
          await appendDiffRow(diffContainer, app, line, sourcePath, plugin);
        }
      }
      await flushEq();
    };

    renderRows().catch(() => {});

    const btnRow = el.createDiv();
    btnRow.style.marginTop = "12px";
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.flexShrink = "0";

    const closeBtn = btnRow.createEl("button", { text: translate("close") });
    closeBtn.onclick = () => this.close();

    if (modalContainer) {
      makeDraggable(modalContainer, titleEl, this.abortController.signal);
      makeResizable(modalContainer, this.abortController.signal);
    }
  }

  onClose() {
    this.abortController.abort();
  }
}

async function appendDiffRow(
  parent: HTMLElement,
  app: any,
  line: DiffLine,
  sourcePath: string,
  component: any
) {
  const row = parent.createDiv();
  row.className = `sh-diff-row sh-diff-row-${line.type}`;

  const numCol = row.createDiv();
  numCol.className = "sh-diff-row-num";
  numCol.textContent = line.oldNo != null ? String(line.oldNo) : "";

  const prefixCol = row.createDiv();
  prefixCol.className = "sh-diff-row-prefix";
  if (line.type === "add") prefixCol.textContent = "+";
  else if (line.type === "remove") prefixCol.textContent = "\u2212";
  else prefixCol.textContent = " ";

  const textCol = row.createDiv();
  textCol.className = "sh-diff-row-text";

  if (line.text.length > 0) {
    const ext = sourcePath.split(".").pop()?.toLowerCase() || "";
    if (ext === "md") {
      try {
          const resolved = await resolveImagesInMarkdown(component, line.text, sourcePath);
          await MarkdownRenderer.render(app, resolved, textCol, sourcePath, component);
      } catch {
        textCol.createEl("span", { text: line.text });
      }
    } else {
      const span = textCol.createEl("span");
      span.style.whiteSpace = "pre-wrap";
      span.style.wordBreak = "break-word";
      span.textContent = line.text;
    }
  }
}

function makeDraggable(el: HTMLElement, handle: HTMLElement, signal?: AbortSignal) {
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

  signal?.addEventListener("abort", () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    handle.removeEventListener("mousedown", onMouseDown);
  });
}

function makeResizable(el: HTMLElement, signal?: AbortSignal) {
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

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    origW = el.offsetWidth;
    origH = el.offsetHeight;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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

  resizer.addEventListener("mousedown", onMouseDown);

  signal?.addEventListener("abort", () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeEventListener("mousedown", onMouseDown);
  });
}
