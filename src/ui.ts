import { Modal, TFile, ItemView, WorkspaceLeaf, MarkdownRenderer, Component } from "obsidian";
import { SaveHistoryPlugin, type GroupByMode } from "./main";
import { listSnapshotsForFile, readSnapshotContent, deleteSnapshotFile, updateSnapshotLabel, savePreRestoreBackup } from "./storage";
import type { SnapshotRecord } from "./storage";
import { computeDiff, type DiffLine } from "./diff";
import { translate } from "./locale";
import { setupVersioning } from "./versioning";

type Versioning = ReturnType<typeof setupVersioning>;

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
        const encoded = new TextEncoder().encode(data);
        const binary = Array.from(encoded, b => String.fromCharCode(b)).join("");
        const dataUrl = `data:${mime};base64,${btoa(binary)}`;
        result = result.split(match.full).join(`![image](${dataUrl})`);
      }
    } catch {
      // skip unresolvable images
    }
  }

  return result;
}

export const VIEW_TYPE_SAVE_HISTORY = "save-history-view";

export function registerCommands(plugin: SaveHistoryPlugin, versioning: Versioning) {
  plugin.addCommand?.({
    id: "save-history:save-now",
    name: translate("cmdSaveNow"),
    callback: () => { void (async () => {
      const file = plugin.getActiveFile();
      if (!file) {
        plugin.toast(translate("noFileOpenSave"));
        return;
      }
      const result = await versioning.saveNowForFile(file, "manual");
      plugin.toast(result === "saved" ? translate("versionSaved") : translate("noChangesDetected"));

      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
      for (const leaf of leaves) {
        if (leaf.view instanceof SaveHistoryView) {
          void leaf.view.refresh();
        }
      }
    })(); },
  } as Parameters<typeof plugin.addCommand>[0]);

  plugin.addCommand?.({
    id: "save-history:restore",
    name: translate("cmdRestore"),
    callback: () => { void (async () => {
      const file = plugin.getActiveFile();
      if (!file) {
        plugin.toast(translate("noFileOpenRestore"));
        return;
      }
      new RestoreVersionModal(plugin, file, versioning).open();
    })(); },
  } as Parameters<typeof plugin.addCommand>[0]);

  plugin.addCommand?.({
    id: "save-history:open-sidebar",
    name: translate("cmdOpenSidebar"),
    callback: () => { void (async () => {
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
    })(); },
  } as Parameters<typeof plugin.addCommand>[0]);

  plugin.addCommand?.({
    id: "save-history:restore-last-backup",
    name: translate("cmdRestoreLastBackup"),
    callback: () => { void (async () => {
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
      await versioning.restoreFromSnapshot(file, restored);
      await deleteSnapshotFile(plugin, preRestoreBackup.filePath);
      plugin.toast(translate("backupRestored"));

      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
      for (const leaf of leaves) {
        if (leaf.view instanceof SaveHistoryView) {
          void leaf.view.refresh();
        }
      }
    })(); },
  } as Parameters<typeof plugin.addCommand>[0]);
}

export class SaveHistoryView extends ItemView {
  private plugin: SaveHistoryPlugin;
  private versioning: Versioning;
  private diffMode: boolean = false;
  private diffSelection: (SnapshotRecord & { filePath: string })[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: SaveHistoryPlugin, versioning: Versioning) {
    super(leaf);
    this.plugin = plugin;
    this.versioning = versioning;

    this.plugin.registerEvent(
      this.plugin.app.workspace.on("file-open", () => void this.refresh())
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
    this.containerEl.empty();

    const wrapper = this.containerEl.createDiv({ cls: "sh-sidebar" });

    const headerRow = wrapper.createDiv({ cls: "sh-header-row" });

    headerRow.createEl("h3", { text: translate("viewTitle"), cls: "sh-header-title" });

    const groupSelect = headerRow.createEl("select", { cls: "sh-group-select" });
    const opts: { value: GroupByMode; label: string }[] = [
      { value: "none", label: translate("groupNone") },
      { value: "day", label: translate("groupDay") },
      { value: "week", label: translate("groupWeek") },
      { value: "month", label: translate("groupMonth") },
      { value: "year", label: translate("groupYear") },
    ];
    for (const o of opts) {
      const opt = groupSelect.createEl("option", { text: o.label });
      opt.value = o.value;
      if (this.plugin.settings.groupBy === o.value) {
        opt.selected = true;
      }
    }
    groupSelect.onchange = async () => {
      this.plugin.settings.groupBy = groupSelect.value as GroupByMode;
      await this.plugin.saveSettings();
      this.refresh();
    };

    const activeFile = this.plugin.getActiveFile();
    if (!activeFile) {
      wrapper.createDiv({ text: translate("noActiveFile"), cls: "nav-header" });
      return;
    }

    wrapper.createDiv({ text: translate("fileLabel", { name: activeFile.name }), cls: "sh-file-label" });

    const saveBtn = wrapper.createEl("button", { text: translate("saveVersionNow"), cls: "sh-save-btn" });
    saveBtn.onclick = async () => {
      const curFile = this.plugin.getActiveFile();
      if (!curFile) return;
      const result = await this.versioning.saveNowForFile(curFile, "manual");
      this.plugin.toast(result === "saved" ? translate("versionSaved") : translate("noChangesDetected"));
      this.refresh();
    };

    const diffBtnRow = wrapper.createDiv({ cls: "sh-diff-btn-row" });

    const diffToggleBtn = diffBtnRow.createEl("button", { text: this.diffMode ? translate("cancelDiff") : translate("diffTwoVersions"), cls: "sh-diff-toggle-btn" });
    diffToggleBtn.onclick = () => {
      this.diffMode = !this.diffMode;
      this.diffSelection = [];
      this.refresh();
    };

    if (this.diffMode && this.diffSelection.length === 2) {
      const diffGoBtn = diffBtnRow.createEl("button", { text: translate("showDiff"), cls: "sh-diff-go-btn" });
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

    const listContainer = wrapper.createDiv({ cls: "sh-diff-list" });

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

          const groupEl = listContainer.createDiv({ cls: "sh-group" });

          const groupHeader = groupEl.createDiv({ cls: "sh-group-header" });

          const chevron = groupHeader.createEl("span", { text: isCollapsed ? "\u25B8 " : "\u25BE ", cls: "sh-group-chevron" });

          const groupTitle = groupHeader.createEl("span", { cls: "sh-group-title" });
          groupTitle.textContent = group.label;

          groupHeader.createEl("span", { text: ` (${group.snapshots.length})`, cls: "sh-group-count" });

          const itemsEl = groupEl.createDiv({ cls: "sh-group-items" });
          if (isCollapsed) {
            itemsEl.classList.add("is-collapsed");
          }

          groupHeader.onclick = async () => {
            const collapsed = this.plugin.settings.collapsedGroups[groupKey];
            if (collapsed) {
              delete this.plugin.settings.collapsedGroups[groupKey];
              itemsEl.classList.remove("is-collapsed");
              chevron.textContent = "\u25BE ";
            } else {
              this.plugin.settings.collapsedGroups[groupKey] = true;
              itemsEl.classList.add("is-collapsed");
              chevron.textContent = "\u25B8 ";
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
      wrapper.createEl("hr", { cls: "sh-backup-divider" });

      wrapper.createEl("h4", { text: translate("lastUnsavedVersion"), cls: "sh-backup-header" });

      const backupItem = wrapper.createDiv({ cls: "sh-backup-item" });

      const meta = backupItem.createDiv({ cls: "sh-backup-meta" });
      const date = new Date(preRestoreBackup.timestamp);
      meta.textContent = translate("autoSavedOnRestore", { date: date.toLocaleDateString(), time: date.toLocaleTimeString() });

      const actions = backupItem.createDiv({ cls: "sh-backup-actions" });

      const restoreBtn = actions.createEl("button", { text: translate("restoreBackup"), cls: "sh-backup-restore-btn" });
      restoreBtn.onclick = async () => {
        const curFile = this.plugin.getActiveFile();
        if (!curFile) return;

        const restored = await readSnapshotContent(this.plugin, preRestoreBackup.filePath);
        if (!restored) {
          this.plugin.toast(translate("failedLoadBackup"));
          return;
        }

        await this.versioning.restoreFromSnapshot(curFile, restored);
        await deleteSnapshotFile(this.plugin, preRestoreBackup.filePath);
        this.plugin.toast(translate("backupRestored"));
        this.refresh();
      };

      const deleteBtn = actions.createEl("button", { text: translate("delete"), cls: "sh-backup-delete-btn" });
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        const curFile = this.plugin.getActiveFile();
        if (!curFile) return;

        actions.empty();

        actions.createEl("span", { text: translate("deleteBackup"), cls: "sh-backup-confirm-text" });

        const yesBtn = actions.createEl("button", { text: translate("yes"), cls: "sh-delete-yes-btn" });
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

        const noBtn = actions.createEl("button", { text: translate("no"), cls: "sh-delete-no-btn" });
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
        label = `${startLabel} \u2013 ${endLabel}`;
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
    const item = parent.createDiv({ cls: "sh-snapshot-item" });

    const isSelected = this.diffSelection.some(s => s.filePath === snap.filePath);
    if (isSelected) {
      item.classList.add("is-selected");
    }

    const date = new Date(snap.timestamp);

    const meta = item.createDiv({ cls: "sh-snapshot-meta" });

    const renderNormalState = () => {
      meta.empty();

      const nameRow = meta.createDiv({ cls: "sh-snapshot-name-row" });

      let selectionLabel: string | null = null;
      if (this.diffMode) {
        const idx = this.diffSelection.findIndex(s => s.filePath === snap.filePath);
        if (idx === 0) selectionLabel = translate("diffNewer");
        else if (idx === 1) selectionLabel = translate("diffOlder");
      }

      const label = nameRow.createEl("span", { cls: "sh-snapshot-label" });
      label.textContent = snap.reason;

      if (selectionLabel) {
        nameRow.createEl("span", { text: ` [${selectionLabel}]`, cls: "sh-snapshot-sel-label" });
      }

      if (!this.diffMode) {
        const dotsBtn = nameRow.createEl("span", { text: "\u22EE", cls: "sh-snapshot-dots" });
        dotsBtn.title = translate("moreActions");

        const doc = activeDocument as Document;
        const dropdown = doc.createElement("div");
        dropdown.dataset.saveHistoryDropdown = "";
        dropdown.classList.add("sh-dropdown");

        const addMenuItem = (text: string, onClick: () => void) => {
          const menuItem = dropdown.createDiv({ text, cls: "sh-menu-item" });
          menuItem.addEventListener("click", (e) => {
            e.stopPropagation();
            closeDropdown();
            onClick();
          });
        };

        const closeDropdown = () => {
          dropdown.classList.remove("is-open");
          doc.removeEventListener("mousedown", onOutsideMouseDown, true);
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
          dropdown.classList.add("is-open");
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
          doc.addEventListener("mousedown", onOutsideMouseDown, true);
        };

        addMenuItem(translate("renameVersion"), () => renderEditState());

        addMenuItem(translate("diffWithCurrent"), () => { void (async () => {
          const curFile = this.plugin.getActiveFile();
          if (!curFile) return;
          const snapContent = await readSnapshotContent(this.plugin, snap.filePath);
          if (!snapContent) {
            this.plugin.toast(translate("failedLoadSnapshot"));
            return;
          }
          const currentContent = await this.plugin.app.vault.read(curFile);
          const currentSnap: SnapshotRecord & { filePath: string } = {
            path: curFile.path,
            content: currentContent,
            timestamp: new Date().toISOString(),
            reason: translate("currentFile"),
            filePath: curFile.path,
          };
          new DiffModal(this.plugin, snap, currentSnap, snapContent.content, currentContent).open();
        })(); });

        addMenuItem(translate("exportVersion"), () => { void (async () => {
          closeDropdown();
          const snapContent = await readSnapshotContent(this.plugin, snap.filePath);
          if (!snapContent) {
            this.plugin.toast(translate("failedLoadSnapshot"));
            return;
          }
          try {
            const ext = activeFile.extension;
            const baseName = activeFile.name.replace(/\.[^.]+$/, "");
            const d = new Date(snap.timestamp);
            const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}-${String(d.getSeconds()).padStart(2, "0")}`;
            const defaultName = `${baseName}_${ts}.${ext}`;

            const blob = new Blob([snapContent.content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = doc.createElement("a");
            a.href = url;
            a.download = defaultName;
            doc.body.appendChild(a);
            a.click();
            doc.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.plugin.toast(translate("exportSuccess"));
          } catch {
            this.plugin.toast(translate("failedLoadSnapshot"));
          }
        })(); });

        addMenuItem(translate("delete"), () => {
          closeDropdown();
          showDeleteConfirm();
        });

        doc.body.appendChild(dropdown);

        dotsBtn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropdown.classList.contains("is-open")) {
            closeDropdown();
          } else {
            openDropdown();
          }
        });
      }

      const timeRow = meta.createDiv({ cls: "sh-snapshot-time" });
      if (isSelected) {
        timeRow.classList.add("is-selected");
      }
      const groupBy = this.plugin.settings.groupBy;
      if (groupBy === "day") {
        timeRow.textContent = date.toLocaleTimeString();
      } else {
        timeRow.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }
    };

    const renderEditState = () => {
      meta.empty();

      const input = meta.createEl("input", { cls: "sh-inline-input" });
      input.type = "text";
      input.value = snap.reason;

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

      const controls = meta.createDiv({ cls: "sh-inline-controls" });

      const okBtn = controls.createEl("span", { text: "\u2714\uFE0F", cls: "sh-inline-ok" });
      okBtn.title = translate("save");
      okBtn.onclick = async (ev) => {
        ev.stopPropagation();
        await saveLabel();
      };

      const cancelBtn = controls.createEl("span", { text: "\u274C", cls: "sh-inline-cancel" });
      cancelBtn.title = translate("cancel");
      cancelBtn.onclick = (ev) => {
        ev.stopPropagation();
        renderNormalState();
      };

      window.setTimeout(() => input.focus(), 50);
    };

    renderNormalState();

    if (this.diffMode) {
      const diffSelectBtn = item.createEl("button", {
        text: isSelected
          ? translate("deselect")
          : this.diffSelection.length < 2
          ? translate("selectForDiff")
          : translate("replaceSelection"),
        cls: "sh-snapshot-diff-btn"
      });
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

    const actions = item.createDiv({ cls: "sh-snapshot-actions" });

    const showDeleteConfirm = () => {
      actions.empty();
      actions.createEl("span", { text: translate("deleteConfirm"), cls: "sh-delete-confirm-text" });

      const yesBtn = actions.createEl("button", { text: translate("yes"), cls: "sh-delete-yes-btn" });
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

      const noBtn = actions.createEl("button", { text: translate("no"), cls: "sh-delete-no-btn" });
      noBtn.onclick = (ev) => {
        ev.stopPropagation();
        this.refresh();
      };
    };

    const restoreBtn = actions.createEl("button", { text: translate("restore"), cls: "sh-snapshot-restore-btn" });
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

    const previewBtn = actions.createEl("button", { text: translate("preview"), cls: "sh-snapshot-preview-btn" });
    previewBtn.onclick = async () => {
      const curFile = this.plugin.getActiveFile();
      if (!curFile) return;
      const restored = await readSnapshotContent(this.plugin, snap.filePath);
      if (!restored) return;

      const previewModal = new Modal(this.plugin.app);
      const previewAbort = new AbortController();
      previewModal.onOpen = () => {
        const el = previewModal.contentEl;
        el.empty();

        const modalContainer = (previewModal as unknown as { modalEl?: HTMLElement }).modalEl;
        if (modalContainer) {
          modalContainer.classList.add("sh-preview-modal");
        }

        el.classList.add("sh-preview-body");

        const titleEl = el.createEl("h2", { cls: "sh-preview-title" });
        titleEl.textContent = snap.reason;

        const timeEl = el.createDiv({ cls: "sh-preview-time" });
        timeEl.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        const content = el.createDiv({ cls: "sh-preview-body sh-preview-content" });

        const resolvedContent = resolveImagesInMarkdown(this.plugin, restored.content, curFile.path);
        resolvedContent.then((resolved) => {
          if (curFile.extension === "md") {
            void MarkdownRenderer.render(this.plugin.app, resolved, content, curFile.path, this);
          } else {
            const pre = content.createEl("pre", { cls: "sh-raw-pre" });
            pre.textContent = resolved;
          }
        }).catch(() => {});

        const btnRow = el.createDiv({ cls: "sh-preview-btn-row" });

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

  refresh(): void {
    void this.onOpen();
  }

  async onClose() {
    this.cleanupDropdowns();
  }

  private cleanupDropdowns() {
    const doc = activeDocument as Document;
    doc.querySelectorAll("[data-save-history-dropdown]").forEach(el => el.remove());
  }
}

class RestoreVersionModal extends Modal {
  private file: TFile;
  private plugin: SaveHistoryPlugin;
  private versioning: Versioning;

  private loadingEl!: HTMLElement;
  private listEl!: HTMLElement;

  private snapshots: (SnapshotRecord & { filePath: string })[] = [];

  constructor(plugin: SaveHistoryPlugin, file: TFile, versioning: Versioning) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    this.versioning = versioning;
  }

  onOpen() {
    const contentEl = this.contentEl;
    contentEl.empty();

    const title = contentEl.createEl("h2");
    title.textContent = translate("restoreVersion");

    this.loadingEl = contentEl.createDiv();
    this.loadingEl.textContent = translate("loadingVersions");

    this.listEl = contentEl.createDiv();

    void this.refresh();

    const closeBtn = contentEl.createEl("button");
    closeBtn.textContent = translate("close");
    closeBtn.onclick = () => this.close();
  }

  private async refresh() {
    this.loadingEl.textContent = translate("loadingVersions");

    this.snapshots = await listSnapshotsForFile(this.plugin, this.file.path);

    this.listEl.innerHTML = "";

    if (!this.snapshots.length) {
      const empty = this.listEl.createDiv();
      empty.textContent = translate("noSavedVersionsYet");
      this.loadingEl.textContent = "";
      return;
    }

    for (const snap of this.snapshots) {
      const row = this.listEl.createDiv({ cls: "sh-restore-row" });

      const meta = row.createDiv({ cls: "sh-restore-meta" });

      const nameLabel = meta.createEl("span", { cls: "sh-restore-name" });
      nameLabel.textContent = snap.reason || translate("unnamed");

      const timeLabel = meta.createEl("span", { cls: "sh-restore-time" });
      const d = new Date(snap.timestamp);
      timeLabel.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;

      const btn = row.createEl("button");
      btn.textContent = translate("restore");
      btn.onclick = async () => {
        await this.restoreSnapshot(snap);
      };
    }

    this.loadingEl.textContent = "";
  }

  private async restoreSnapshot(snap: SnapshotRecord & { filePath: string }) {
    const restored = await readSnapshotContent(this.plugin, snap.filePath);
    if (!restored) {
      this.plugin.toast(translate("failedLoadSnapshotDot"));
      return;
    }

    const currentContent = await this.plugin.app.vault.read(this.file);
    await savePreRestoreBackup(this.plugin, this.file.path, currentContent);

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

    const modalContainer = (this as unknown as { modalEl?: HTMLElement }).modalEl;
    if (modalContainer) {
      modalContainer.classList.add("sh-diff-modal");
    }

    el.classList.add("sh-preview-body");

    const titleEl = el.createEl("h2", { text: translate("diff"), cls: "sh-preview-title" });

    const oldDate = new Date(this.snapOld.timestamp);
    const newDate = new Date(this.snapNew.timestamp);

    const infoRow = el.createDiv({ cls: "sh-diff-info-row" });

    const oldTag = infoRow.createEl("span", { cls: "sh-diff-tag sh-diff-tag-old" });
    oldTag.textContent = `${this.snapOld.reason} \u2014 ${oldDate.toLocaleDateString()} ${oldDate.toLocaleTimeString()}`;

    infoRow.createEl("span", { text: "\u2192", cls: "sh-diff-arrow" });

    const newTag = infoRow.createEl("span", { cls: "sh-diff-tag sh-diff-tag-new" });
    newTag.textContent = `${this.snapNew.reason} \u2014 ${newDate.toLocaleDateString()} ${newDate.toLocaleTimeString()}`;

    const diff = computeDiff(this.contentOld, this.contentNew);
    const added = diff.filter(l => l.type === "add").length;
    const removed = diff.filter(l => l.type === "remove").length;

    const stats = el.createDiv({ cls: "sh-diff-stats" });
    if (added === 0 && removed === 0) {
      stats.textContent = translate("noDifferences");
    } else {
      stats.createEl("span", { text: translate("added", { n: added }), cls: "sh-diff-stats-added" });
      stats.createEl("span", { text: "  " });
      stats.createEl("span", { text: translate("removed", { n: removed }), cls: "sh-diff-stats-removed" });
    }

    const diffContainer = el.createDiv({ cls: "sh-diff-container" });

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
          const bar = diffContainer.createDiv({ cls: "sh-diff-collapse" });
          bar.textContent = translate("unchangedLinesShow", { n: hidden.length });
          const hiddenEl = diffContainer.createDiv({ cls: "sh-diff-hidden" });
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

    const btnRow = el.createDiv({ cls: "sh-diff-btn-row" });

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
  app: SaveHistoryPlugin["app"],
  line: DiffLine,
  sourcePath: string,
  component: Component
) {
  const row = parent.createDiv({ cls: `sh-diff-row sh-diff-row-${line.type}` });

  const numCol = row.createDiv({ cls: "sh-diff-row-num" });
  numCol.textContent = line.oldNo != null ? String(line.oldNo) : "";

  const prefixCol = row.createDiv({ cls: "sh-diff-row-prefix" });
  if (line.type === "add") prefixCol.textContent = "+";
  else if (line.type === "remove") prefixCol.textContent = "\u2212";
  else prefixCol.textContent = " ";

  const textCol = row.createDiv({ cls: "sh-diff-row-text" });

  if (line.text.length > 0) {
    const ext = sourcePath.split(".").pop()?.toLowerCase() || "";
    if (ext === "md") {
      try {
        const resolved = await resolveImagesInMarkdown(component as unknown as SaveHistoryPlugin, line.text, sourcePath);
        await MarkdownRenderer.render(app, resolved, textCol, sourcePath, component);
      } catch {
        textCol.createEl("span", { text: line.text });
      }
    } else {
      const span = textCol.createEl("span", { cls: "sh-raw-text" });
      span.textContent = line.text;
    }
  }
}

function makeDraggable(el: HTMLElement, handle: HTMLElement, signal?: AbortSignal) {
  const doc = activeDocument as Document;
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

    el.classList.add("sh-dragging");
    el.style.left = origLeft + "px";
    el.style.top = origTop + "px";

    doc.addEventListener("mousemove", onMouseMove);
    doc.addEventListener("mouseup", onMouseUp);
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
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
  };

  handle.addEventListener("mousedown", onMouseDown);

  signal?.addEventListener("abort", () => {
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
    handle.removeEventListener("mousedown", onMouseDown);
  });
}

function makeResizable(el: HTMLElement, signal?: AbortSignal) {
  const doc = activeDocument as Document;
  const resizer = el.createDiv({ cls: "sh-resizer" });
  resizer.createDiv({ cls: "sh-resizer-line1" });
  resizer.createDiv({ cls: "sh-resizer-line2" });

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

    doc.addEventListener("mousemove", onMouseMove);
    doc.addEventListener("mouseup", onMouseUp);
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
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
  };

  resizer.addEventListener("mousedown", onMouseDown);

  signal?.addEventListener("abort", () => {
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
    resizer.removeEventListener("mousedown", onMouseDown);
  });
}
