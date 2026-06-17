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

// src/diff.ts
function computeDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;
  if (n === 0 && m === 0) return [];
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i2 = 1; i2 <= n; i2++) {
    for (let j2 = 1; j2 <= m; j2++) {
      if (oldLines[i2 - 1] === newLines[j2 - 1]) {
        dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;
      } else {
        dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);
      }
    }
  }
  const edits = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: "equal", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ type: "add", oldIdx: -1, newIdx: j - 1 });
      j--;
    } else {
      edits.unshift({ type: "remove", oldIdx: i - 1, newIdx: -1 });
      i--;
    }
  }
  const result = [];
  let oldNo = 1;
  let newNo = 1;
  for (const edit of edits) {
    if (edit.type === "equal") {
      result.push({ type: "equal", oldNo: oldNo++, newNo: newNo++, text: oldLines[edit.oldIdx] });
    } else if (edit.type === "add") {
      result.push({ type: "add", newNo: newNo++, text: newLines[edit.newIdx] });
    } else {
      result.push({ type: "remove", oldNo: oldNo++, text: oldLines[edit.oldIdx] });
    }
  }
  return result;
}
var init_diff = __esm({
  "src/diff.ts"() {
    "use strict";
  }
});

// src/ui.ts
async function resolveImagesInMarkdown(plugin, markdown, sourcePath) {
  const adapter = plugin.app.vault.adapter;
  const parentFolder = sourcePath.includes("/") ? sourcePath.substring(0, sourcePath.lastIndexOf("/")) : "";
  const wikiImageRegex = /!\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g;
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let result = markdown;
  const matches = [];
  let m;
  while ((m = wikiImageRegex.exec(markdown)) !== null) {
    matches.push({ full: m[0], path: m[1].trim() });
  }
  while ((m = mdImageRegex.exec(markdown)) !== null) {
    matches.push({ full: m[0], path: m[2].trim() });
  }
  for (const match of matches) {
    const imgPath = match.path.startsWith("/") ? match.path.substring(1) : parentFolder ? `${parentFolder}/${match.path}` : match.path;
    try {
      if (await adapter.exists(imgPath)) {
        const data = await adapter.read(imgPath);
        const ext = imgPath.split(".").pop()?.toLowerCase() || "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : ext === "webp" ? "image/webp" : "image/png";
        const dataUrl = `data:${mime};base64,${btoa(unescape(encodeURIComponent(data)))}`;
        result = result.split(match.full).join(`![image](${dataUrl})`);
      }
    } catch {
    }
  }
  return result;
}
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
async function appendDiffRow(parent, app, line, sourcePath, component) {
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
    try {
      const resolved = await resolveImagesInMarkdown(component, line.text, sourcePath);
      await import_obsidian.MarkdownRenderer.render(app, resolved, textCol, sourcePath, component);
    } catch {
      textCol.createEl("span", { text: line.text });
    }
  }
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
var import_obsidian, VIEW_TYPE_SAVE_HISTORY, SaveHistoryView, RestoreVersionModal, DiffModal;
var init_ui = __esm({
  "src/ui.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    init_storage();
    init_diff();
    VIEW_TYPE_SAVE_HISTORY = "save-history-view";
    SaveHistoryView = class extends import_obsidian.ItemView {
      constructor(leaf, plugin, versioning) {
        super(leaf);
        this.diffMode = false;
        this.diffSelection = [];
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
        const opts = [
          { value: "none", label: "No grouping" },
          { value: "day", label: "By day" },
          { value: "week", label: "By week" },
          { value: "month", label: "By month" },
          { value: "year", label: "By year" }
        ];
        for (const o of opts) {
          const opt = groupSelect.createEl("option", { text: o.label });
          opt.value = o.value;
          if (this.plugin.settings.groupBy === o.value) {
            opt.selected = true;
          }
        }
        groupSelect.onchange = async () => {
          this.plugin.settings.groupBy = groupSelect.value;
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
        const diffBtnRow = wrapper.createDiv();
        diffBtnRow.style.display = "flex";
        diffBtnRow.style.gap = "6px";
        const diffToggleBtn = diffBtnRow.createEl("button", { text: this.diffMode ? "Cancel Diff" : "Diff Two Versions" });
        diffToggleBtn.style.flex = "1";
        diffToggleBtn.onclick = () => {
          this.diffMode = !this.diffMode;
          this.diffSelection = [];
          this.refresh();
        };
        if (this.diffMode && this.diffSelection.length === 2) {
          const diffGoBtn = diffBtnRow.createEl("button", { text: "Show Diff" });
          diffGoBtn.style.flex = "1";
          diffGoBtn.style.fontWeight = "600";
          diffGoBtn.onclick = async () => {
            const recOld = await readSnapshotContent(this.plugin, this.diffSelection[1].filePath);
            const recNew = await readSnapshotContent(this.plugin, this.diffSelection[0].filePath);
            if (!recOld || !recNew) {
              this.plugin.toast("Failed to load snapshot content.");
              return;
            }
            new DiffModal(this.plugin, this.diffSelection[1], this.diffSelection[0], recOld.content, recNew.content).open();
            this.diffMode = false;
            this.diffSelection = [];
            this.refresh();
          };
        }
        if (this.diffMode && this.diffSelection.length > 0) {
          const diffClearBtn = diffBtnRow.createEl("button", { text: "Clear" });
          diffClearBtn.onclick = () => {
            this.diffSelection = [];
            this.refresh();
          };
        }
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
              const chevron = groupHeader.createEl("span", { text: isCollapsed ? "\u25B8 " : "\u25BE " });
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
                  chevron.textContent = "\u25BE ";
                } else {
                  this.plugin.settings.collapsedGroups[groupKey] = true;
                  itemsEl.style.display = "none";
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
      groupSnapshots(snapshots, groupBy) {
        const groups = /* @__PURE__ */ new Map();
        for (const snap of snapshots) {
          const date = new Date(snap.timestamp);
          let key;
          let label;
          if (groupBy === "day") {
            key = date.toISOString().slice(0, 10);
            label = date.toLocaleDateString(void 0, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          } else if (groupBy === "week") {
            const weekStart = this.getWeekStart(date);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            key = weekStart.toISOString().slice(0, 10);
            const startLabel = weekStart.toLocaleDateString(void 0, { month: "short", day: "numeric" });
            const endLabel = weekEnd.toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" });
            label = `${startLabel} \u2013 ${endLabel}`;
          } else if (groupBy === "month") {
            key = date.toISOString().slice(0, 7);
            label = date.toLocaleDateString(void 0, { year: "numeric", month: "long" });
          } else {
            key = date.toISOString().slice(0, 4);
            label = date.toLocaleDateString(void 0, { year: "numeric" });
          }
          if (!groups.has(key)) {
            groups.set(key, { key, label, snapshots: [] });
          }
          groups.get(key).snapshots.push(snap);
        }
        return Array.from(groups.values());
      }
      getWeekStart(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d;
      }
      renderSnapshotItem(parent, snap, activeFile) {
        const item = parent.createDiv();
        item.style.padding = "8px";
        item.style.border = "1px solid var(--background-modifier-border)";
        item.style.borderRadius = "4px";
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "4px";
        const isSelected = this.diffSelection.some((s) => s.filePath === snap.filePath);
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
          let selectionLabel = null;
          if (this.diffMode) {
            const idx = this.diffSelection.findIndex((s) => s.filePath === snap.filePath);
            if (idx === 0) selectionLabel = "1 (newer)";
            else if (idx === 1) selectionLabel = "2 (older)";
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
            const editBtn = nameRow.createEl("span", { text: "\u270F\uFE0F" });
            editBtn.style.cursor = "pointer";
            editBtn.style.marginLeft = "6px";
            editBtn.title = "Rename version";
            editBtn.onclick = (e) => {
              e.stopPropagation();
              renderEditState();
            };
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
        if (this.diffMode) {
          const diffSelectBtn = item.createEl("button", {
            text: isSelected ? "Deselect" : this.diffSelection.length < 2 ? "Select for Diff" : "Replace Selection"
          });
          diffSelectBtn.style.width = "100%";
          diffSelectBtn.style.fontSize = "0.85em";
          diffSelectBtn.onclick = (e) => {
            e.stopPropagation();
            if (isSelected) {
              this.diffSelection = this.diffSelection.filter((s) => s.filePath !== snap.filePath);
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
          previewModal.onOpen = async () => {
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
            const imgStyle = document.createElement("style");
            imgStyle.textContent = `
          .sh-preview-content img { max-width: 100%; height: auto; }
          .sh-preview-content svg { max-width: 100%; }
        `;
            content.appendChild(imgStyle);
            content.classList.add("sh-preview-content");
            const resolvedContent = await resolveImagesInMarkdown(this.plugin, restored.content, curFile.path);
            await import_obsidian.MarkdownRenderer.render(this.plugin.app, resolvedContent, content, curFile.path, this.plugin);
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
    DiffModal = class extends import_obsidian.Modal {
      constructor(plugin, snapOld, snapNew, contentOld, contentNew) {
        super(plugin.app);
        this.plugin = plugin;
        this.snapOld = snapOld;
        this.snapNew = snapNew;
        this.contentOld = contentOld;
        this.contentNew = contentNew;
      }
      onOpen() {
        const el = this.contentEl;
        el.empty();
        const modalContainer = this.modalEl;
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
        const titleEl = el.createEl("h2", { text: "Diff" });
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
        oldTag.textContent = `${this.snapOld.reason} \u2014 ${oldDate.toLocaleDateString()} ${oldDate.toLocaleTimeString()}`;
        const arrow = infoRow.createEl("span", { text: "\u2192" });
        arrow.style.fontSize = "1.2em";
        arrow.style.color = "var(--text-muted)";
        const newTag = infoRow.createEl("span");
        newTag.style.padding = "2px 8px";
        newTag.style.borderRadius = "4px";
        newTag.style.backgroundColor = "rgba(46, 160, 67, 0.15)";
        newTag.style.border = "1px solid rgba(46, 160, 67, 0.4)";
        newTag.style.color = "var(--text-muted)";
        newTag.textContent = `${this.snapNew.reason} \u2014 ${newDate.toLocaleDateString()} ${newDate.toLocaleTimeString()}`;
        const diff = computeDiff(this.contentOld, this.contentNew);
        const added = diff.filter((l) => l.type === "add").length;
        const removed = diff.filter((l) => l.type === "remove").length;
        const stats = el.createDiv();
        stats.style.fontSize = "0.8em";
        stats.style.color = "var(--text-muted)";
        stats.style.marginBottom = "8px";
        stats.style.flexShrink = "0";
        if (added === 0 && removed === 0) {
          stats.textContent = "No differences";
        } else {
          const sAdd = stats.createEl("span", { text: `+${added} added` });
          sAdd.style.color = "#2ea043";
          stats.createEl("span", { text: "  " });
          const sRem = stats.createEl("span", { text: `-${removed} removed` });
          sRem.style.color = "#f85149";
        }
        const diffContainer = el.createDiv();
        diffContainer.style.flex = "1";
        diffContainer.style.overflowY = "auto";
        diffContainer.style.border = "1px solid var(--background-modifier-border)";
        diffContainer.style.borderRadius = "6px";
        diffContainer.style.backgroundColor = "var(--background-primary)";
        const style = document.createElement("style");
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
        diffContainer.appendChild(style);
        const curFile = this.plugin.getActiveMarkdownFile();
        const sourcePath = curFile?.path ?? "";
        const app = this.plugin.app;
        const plugin = this.plugin;
        const COLLAPSE = 4;
        const renderRows = async () => {
          let eqRun = [];
          const flushEq = async () => {
            if (eqRun.length === 0) return;
            if (eqRun.length > COLLAPSE * 2) {
              for (const line of eqRun.slice(0, COLLAPSE)) {
                await appendDiffRow(diffContainer, app, line, sourcePath, plugin);
              }
              const hidden = eqRun.slice(COLLAPSE, eqRun.length - COLLAPSE);
              const bar = diffContainer.createDiv();
              bar.className = "sh-diff-collapse";
              bar.textContent = `\u25BE  ${hidden.length} unchanged lines (click to show)  \u25BE`;
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
                  bar.textContent = `\u25B4  ${hidden.length} unchanged lines (click to hide)  \u25B4`;
                } else {
                  hiddenEl.classList.add("sh-diff-hidden");
                  bar.textContent = `\u25BE  ${hidden.length} unchanged lines (click to show)  \u25BE`;
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
        renderRows().catch(() => {
        });
        const btnRow = el.createDiv();
        btnRow.style.marginTop = "12px";
        btnRow.style.display = "flex";
        btnRow.style.gap = "8px";
        btnRow.style.flexShrink = "0";
        const closeBtn = btnRow.createEl("button", { text: "Close" });
        closeBtn.onclick = () => this.close();
        if (modalContainer) {
          makeDraggable(modalContainer, titleEl);
          makeResizable(modalContainer);
        }
      }
    };
  }
});

// src/main.ts
var import_obsidian2, DEFAULT_SETTINGS, SaveHistoryPlugin;
var init_main = __esm({
  "src/main.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    init_versioning();
    init_ui();
    DEFAULT_SETTINGS = {
      groupBy: "day",
      collapsedGroups: {}
    };
    SaveHistoryPlugin = class extends import_obsidian2.Plugin {
      constructor() {
        super(...arguments);
        this.disposer = null;
        this.settings = DEFAULT_SETTINGS;
      }
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
        const data = await this.loadData?.();
        if (data) {
          this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        }
      }
      async saveSettings() {
        await this.saveData?.(this.settings);
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
