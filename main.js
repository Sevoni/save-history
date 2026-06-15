"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/storage.ts
function getSnapshotDirPath(vaultRelativePath) {
  const normalized = vaultRelativePath.replace(/^\/+/, "");
  return `${SNAPSHOT_ROOT}/${normalized}`;
}
function getSnapshotFilePath(vaultRelativePath, timestamp) {
  const safeTimestamp = timestamp.replace(/:/g, "-");
  return `${getSnapshotDirPath(vaultRelativePath)}/${safeTimestamp}.json`;
}
async function ensureSnapshotDir(plugin, vaultRelativePath) {
  const dirPath = getSnapshotDirPath(vaultRelativePath);
  const adapter = plugin.app.vault.adapter;
  const parts = dirPath.split("/");
  let currentPath = "";
  for (const part of parts) {
    if (!part) continue;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (!await adapter.exists(currentPath)) {
      try {
        await adapter.mkdir(currentPath);
      } catch {
      }
    }
  }
}
async function saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason) {
  await ensureSnapshotDir(plugin, vaultRelativePath);
  const record = { path: vaultRelativePath, timestamp, content, reason };
  const filePath = getSnapshotFilePath(vaultRelativePath, timestamp);
  const adapter = plugin.app.vault.adapter;
  await adapter.write(filePath, JSON.stringify(record, null, 2));
}
async function listSnapshotsForFile(plugin, vaultRelativePath) {
  const dirPath = getSnapshotDirPath(vaultRelativePath);
  const adapter = plugin.app.vault.adapter;
  if (!await adapter.exists(dirPath)) {
    return [];
  }
  let listResult;
  try {
    listResult = await adapter.list(dirPath);
  } catch {
    return [];
  }
  const jsonFiles = (listResult.files || []).map((p) => p.replace(/\\/g, "/")).filter((p) => p.endsWith(".json")).sort();
  const snapshots = [];
  for (const p of jsonFiles) {
    try {
      const json = await adapter.read(p);
      if (json) {
        const record = JSON.parse(json);
        snapshots.push({
          ...record,
          filePath: p
        });
      }
    } catch {
    }
  }
  snapshots.sort((a, b) => a.timestamp > b.timestamp ? -1 : 1);
  return snapshots;
}
async function readSnapshotContent(plugin, filePath) {
  const adapter = plugin.app.vault.adapter;
  if (!await adapter.exists(filePath)) {
    return null;
  }
  try {
    const json = await adapter.read(filePath);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
async function deleteSnapshotFile(plugin, filePath) {
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(filePath)) {
    try {
      await adapter.remove(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
async function updateSnapshotLabel(plugin, filePath, newLabel) {
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(filePath)) {
    try {
      const json = await adapter.read(filePath);
      const record = JSON.parse(json);
      record.reason = newLabel;
      await adapter.write(filePath, JSON.stringify(record, null, 2));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
async function savePreRestoreBackup(plugin, vaultRelativePath, content) {
  const dirPath = getSnapshotDirPath(vaultRelativePath);
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(dirPath)) {
    try {
      const listResult = await adapter.list(dirPath);
      for (const p of listResult.files || []) {
        if (p.endsWith(".json")) {
          try {
            const json = await adapter.read(p);
            const record = JSON.parse(json);
            if (record.reason === "pre-restore") {
              await adapter.remove(p);
            }
          } catch {
          }
        }
      }
    } catch {
    }
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, "pre-restore");
}
var SNAPSHOT_ROOT;
var init_storage = __esm({
  "src/storage.ts"() {
    "use strict";
    SNAPSHOT_ROOT = ".versions(SH)";
  }
});

// src/versioning.ts
function setupVersioning(plugin) {
  let timeoutId = null;
  async function saveNowForFile(file, reason) {
    if (!file || file.extension !== "md") return;
    const content = await plugin.app.vault.read(file);
    const vaultRelativePath = file.path;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason);
  }
  function startAutosave() {
    const handler = (file) => {
      if (!file || file.extension !== "md") return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const current = plugin.getActiveMarkdownFile();
        if (!current) return;
        await saveNowForFile(current, "auto");
      }, 2e3);
    };
    plugin.app.vault.on?.("modify", handler);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      plugin.app.vault.off?.("modify", handler);
    };
  }
  async function restoreFromSnapshot(file, snapshot) {
    if (!file || file.extension !== "md") return;
    if (!snapshot?.content) return;
    await plugin.app.vault.modify(file, snapshot.content);
  }
  return {
    startAutosave,
    saveNowForFile,
    restoreFromSnapshot
  };
}
var init_versioning = __esm({
  "src/versioning.ts"() {
    "use strict";
    init_storage();
  }
});

// src/ui.ts
function registerCommands(plugin, versioning) {
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
      const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
      for (const leaf of leaves) {
        if (leaf.view instanceof SaveHistoryView) {
          leaf.view.refresh();
        }
      }
    }
  });
  plugin.addCommand?.({
    id: "save-history:restore",
    name: "Restore version\u2026",
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast("Open a markdown (.md) file to restore a version.");
        return;
      }
      new RestoreVersionModal(plugin, file, versioning).open();
    }
  });
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
            active: true
          });
        }
      }
      if (leaf) {
        plugin.app.workspace.revealLeaf(leaf);
      }
    }
  });
}
function makeDraggable(el, handle) {
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;
  let dragging = false;
  const onMouseDown = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
    e.preventDefault();
    dragging = true;
    const rect = el.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
    const parentStyle = el.parentElement?.style;
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
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = origLeft + dx + "px";
    el.style.top = origTop + dy + "px";
  };
  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };
  handle.addEventListener("mousedown", onMouseDown);
}
function makeResizable(el) {
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
    const onMouseMove = (ev) => {
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
var import_obsidian, VIEW_TYPE_SAVE_HISTORY, SaveHistoryView, RestoreVersionModal;
var init_ui = __esm({
  "src/ui.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    init_storage();
    VIEW_TYPE_SAVE_HISTORY = "save-history-view";
    SaveHistoryView = class extends import_obsidian.ItemView {
      constructor(leaf, plugin, versioning) {
        super(leaf);
        this.plugin = plugin;
        this.versioning = versioning;
        this.container = this.containerEl;
        this.plugin.registerEvent(
          this.plugin.app.workspace.on("file-open", () => this.refresh())
        );
      }
      getViewType() {
        return VIEW_TYPE_SAVE_HISTORY;
      }
      getDisplayText() {
        return "File History";
      }
      getIcon() {
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
        const snapshots = allSnapshots.filter((s) => s.reason !== "pre-restore");
        const preRestoreBackup = allSnapshots.find((s) => s.reason === "pre-restore");
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
              const editBtn = nameRow.createEl("span", { text: "\u270F\uFE0F" });
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
              timeRow.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
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
              const okBtn = controls.createEl("span", { text: "\u2714\uFE0F" });
              okBtn.style.cursor = "pointer";
              okBtn.title = "Save";
              okBtn.onclick = async (ev) => {
                ev.stopPropagation();
                await saveLabel();
              };
              const cancelBtn = controls.createEl("span", { text: "\u274C" });
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
              const previewModal = new import_obsidian.Modal(this.plugin.app);
              previewModal.onOpen = () => {
                const el = previewModal.contentEl;
                el.empty();
                const modalContainer = previewModal.modalEl;
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
                import_obsidian.MarkdownRenderer.render(this.plugin.app, restored.content, content, curFile.path, previewModal);
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
      async refresh() {
        await this.onOpen();
      }
    };
    RestoreVersionModal = class extends import_obsidian.Modal {
      constructor(plugin, file, versioning) {
        super(plugin.app);
        this.snapshots = [];
        this.plugin = plugin;
        this.file = file;
        this.versioning = versioning;
      }
      async onOpen() {
        const contentEl = this.contentEl;
        const root = contentEl ?? document.createElement("div");
        root.innerHTML = "";
        const title = document.createElement("h2");
        title.textContent = "Restore version";
        root.appendChild(title);
        this.loadingEl = document.createElement("div");
        this.loadingEl.textContent = "Loading versions\u2026";
        root.appendChild(this.loadingEl);
        this.listEl = document.createElement("div");
        root.appendChild(this.listEl);
        await this.refresh();
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.onclick = () => this.close();
        root.appendChild(closeBtn);
        if (!contentEl) {
        }
      }
      async refresh() {
        this.loadingEl.textContent = "Loading versions\u2026";
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
      async restoreSnapshot(snap) {
        const restored = await readSnapshotContent(this.plugin, snap.filePath);
        if (!restored) {
          this.plugin.toast("Failed to load selected snapshot.");
          return;
        }
        await this.versioning.restoreFromSnapshot(this.file, restored);
        this.plugin.toast("Version restored.");
        this.close();
      }
    };
  }
});

// src/main.ts
var import_obsidian2, SaveHistoryPlugin;
var init_main = __esm({
  "src/main.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    init_versioning();
    init_ui();
    SaveHistoryPlugin = class extends import_obsidian2.Plugin {
      constructor() {
        super(...arguments);
        this.disposer = null;
      }
      async onload() {
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
      getActiveMarkdownFile() {
        const file = this.app.workspace.getActiveFile();
        if (!file) return null;
        if (file.extension !== "md") return null;
        return file;
      }
      toast(message) {
        new import_obsidian2.Notice(message);
      }
    };
  }
});

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
var main_default;
var init_main2 = __esm({
  "main.ts"() {
    "use strict";
    init_main();
    main_default = SaveHistoryPlugin;
  }
});

// entry.js
var pluginModule = (init_main2(), __toCommonJS(main_exports));
var ctor = pluginModule?.default ?? pluginModule?.SaveHistoryPlugin ?? pluginModule;
module.exports = ctor;
//# sourceMappingURL=main.js.map
