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
function getSnapshotRoot(plugin) {
  return plugin.settings.snapshotFolder || LEGACY_SNAPSHOT_ROOT;
}
function getSnapshotDirPath(plugin, vaultRelativePath) {
  const normalized = vaultRelativePath.replace(/^\/+/, "");
  return `${getSnapshotRoot(plugin)}/${normalized}`;
}
function getSnapshotFilePath(plugin, vaultRelativePath, timestamp) {
  const safeTimestamp = timestamp.replace(/:/g, "-");
  return `${getSnapshotDirPath(plugin, vaultRelativePath)}/${safeTimestamp}.json`;
}
async function ensureSnapshotDir(plugin, vaultRelativePath) {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
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
  const filePath = getSnapshotFilePath(plugin, vaultRelativePath, timestamp);
  const adapter = plugin.app.vault.adapter;
  await adapter.write(filePath, JSON.stringify(record, null, 2));
}
async function listSnapshotsForFile(plugin, vaultRelativePath) {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
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
    const fullVaultPath = p.startsWith(dirPath) ? p : `${dirPath}/${p}`;
    try {
      const json = await adapter.read(fullVaultPath);
      if (json) {
        const record = JSON.parse(json);
        snapshots.push({
          ...record,
          filePath: fullVaultPath
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
      await removeEmptySnapshotDirs(plugin, filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
async function removeEmptySnapshotDirs(plugin, filePath) {
  const adapter = plugin.app.vault.adapter;
  const root = getSnapshotRoot(plugin);
  const parts = filePath.replace(/\\/g, "/").split("/");
  parts.pop();
  let dir = parts.join("/");
  while (dir && dir !== root && dir.startsWith(root + "/")) {
    if (!await adapter.exists(dir)) break;
    let listResult;
    try {
      listResult = await adapter.list(dir);
    } catch {
      break;
    }
    const remainingFiles = (listResult.files || []).filter((p) => {
      const name = p.replace(/\\/g, "/").split("/").pop() || "";
      return !name.startsWith(".");
    });
    const remainingFolders = (listResult.folders || []).filter((p) => {
      const name = p.replace(/\\/g, "/").split("/").pop() || "";
      return !name.startsWith(".");
    });
    if (remainingFiles.length > 0 || remainingFolders.length > 0) break;
    try {
      await adapter.rmdir(dir);
    } catch {
      break;
    }
    dir = dir.split("/").slice(0, -1).join("/");
  }
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
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(dirPath)) {
    try {
      const listResult = await adapter.list(dirPath);
      for (const p of listResult.files || []) {
        const fullPath = p.replace(/\\/g, "/");
        const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
        if (fullVaultPath.endsWith(".json")) {
          try {
            const json = await adapter.read(fullVaultPath);
            const record = JSON.parse(json);
            if (record.reason === "pre-restore") {
              await adapter.remove(fullVaultPath);
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
async function resolvePath(adapter, path) {
  const parts = path.replace(/\\/g, "/").split("/").filter((p) => p);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!await adapter.exists(current)) {
      return null;
    }
  }
  return current || null;
}
async function renameSnapshotFolder(adapter, oldName, newName) {
  if (oldName === newName) return true;
  const resolvedOld = await resolvePath(adapter, oldName);
  if (!resolvedOld) return true;
  const parentDir = newName.substring(0, newName.lastIndexOf("/"));
  if (parentDir) {
    const parts = parentDir.replace(/\\/g, "/").split("/").filter((p) => p);
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!await adapter.exists(currentPath)) {
        try {
          await adapter.mkdir(currentPath);
        } catch {
        }
      }
    }
  }
  try {
    await adapter.rename(resolvedOld, newName);
    if (resolvedOld !== newName && await adapter.exists(resolvedOld)) {
      try {
        await adapter.remove(resolvedOld);
      } catch {
      }
    }
    const oldParent = resolvedOld.substring(0, resolvedOld.lastIndexOf("/"));
    if (oldParent) {
      let dir = oldParent;
      while (dir) {
        if (!await adapter.exists(dir)) break;
        let listResult;
        try {
          listResult = await adapter.list(dir);
        } catch {
          break;
        }
        const files = listResult.files || [];
        const folders = listResult.folders || [];
        if (files.length > 0 || folders.length > 0) break;
        const parent = dir.split("/").slice(0, -1).join("/");
        try {
          await adapter.rmdir(dir);
        } catch {
          break;
        }
        if (parent === dir) break;
        dir = parent;
      }
    }
    return true;
  } catch {
    return false;
  }
}
async function deleteSnapshotDirForFile(plugin, vaultRelativePath) {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;
  if (!await adapter.exists(dirPath)) return;
  let listResult;
  try {
    listResult = await adapter.list(dirPath);
  } catch {
    return;
  }
  for (const p of listResult.files || []) {
    const fullPath = p.replace(/\\/g, "/");
    const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
    try {
      await adapter.remove(fullVaultPath);
    } catch {
    }
  }
  for (const p of listResult.folders || []) {
    const fullPath = p.replace(/\\/g, "/");
    const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
    try {
      await adapter.rmdir(fullVaultPath);
    } catch {
    }
  }
  try {
    await adapter.rmdir(dirPath);
  } catch {
  }
  const parentDir = dirPath.substring(0, dirPath.lastIndexOf("/"));
  await removeEmptyParentDirs(plugin, parentDir);
}
async function removeEmptyParentDirs(plugin, dirPath) {
  const snapshotRoot = getSnapshotRoot(plugin);
  let currentDir = dirPath.replace(/\\/g, "/");
  while (currentDir && currentDir !== snapshotRoot && currentDir.startsWith(snapshotRoot + "/")) {
    if (!await plugin.app.vault.adapter.exists(currentDir)) break;
    let isDirEmpty = false;
    try {
      const listResult = await plugin.app.vault.adapter.list(currentDir);
      const files = listResult.files || [];
      const folders = listResult.folders || [];
      isDirEmpty = files.length === 0 && folders.length === 0;
    } catch {
      break;
    }
    if (!isDirEmpty) break;
    try {
      await plugin.app.vault.adapter.rmdir(currentDir);
    } catch {
      break;
    }
    currentDir = currentDir.split("/").slice(0, -1).join("/");
  }
}
var LEGACY_SNAPSHOT_ROOT;
var init_storage = __esm({
  "src/storage.ts"() {
    "use strict";
    LEGACY_SNAPSHOT_ROOT = ".versions(SH)";
  }
});

// src/versioning.ts
function setupVersioning(plugin) {
  async function saveNowForFile(file, reason) {
    if (!file || file.extension !== "md") return "no_change";
    const content = await plugin.app.vault.read(file);
    const vaultRelativePath = file.path;
    const snapshots = await listSnapshotsForFile(plugin, vaultRelativePath);
    const nonPreRestore = snapshots.filter((s) => s.reason !== "pre-restore");
    if (nonPreRestore.length > 0) {
      const latest = nonPreRestore[0];
      const latestContent = await readSnapshotContent(plugin, latest.filePath);
      if (latestContent && latestContent.content === content) {
        return "no_change";
      }
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, reason);
    return "saved";
  }
  async function restoreFromSnapshot(file, snapshot) {
    if (!file || file.extension !== "md") return;
    if (!snapshot?.content) return;
    await plugin.app.vault.modify(file, snapshot.content);
  }
  return {
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

// src/locale.ts
function setLanguage(lang) {
  currentLanguage = lang;
}
function translate(key, params) {
  let str = translations[currentLanguage][key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
var en, ru, translations, currentLanguage;
var init_locale = __esm({
  "src/locale.ts"() {
    "use strict";
    en = {
      cmdSaveNow: "Save version now",
      cmdSaveNowDesc: "Save a version of the current file",
      cmdRestore: "Restore version\u2026",
      cmdRestoreDesc: "Restore a saved version",
      cmdOpenSidebar: "Open history sidebar",
      cmdRestoreLastBackup: "Restore last unsaved version",
      cmdRestoreLastBackupDesc: "Restore the last pre-restore backup for the current file",
      noFileOpenSave: "Open a markdown (.md) file to save a version.",
      noFileOpenRestore: "Open a markdown (.md) file to restore a version.",
      viewTitle: "File History",
      noActiveFile: "No active markdown file.",
      fileLabel: "File: {name}",
      saveVersionNow: "Save version now",
      versionSaved: "Version saved.",
      noSavedVersions: "No saved versions yet.",
      groupNone: "No grouping",
      groupDay: "By day",
      groupWeek: "By week",
      groupMonth: "By month",
      groupYear: "By year",
      diffTwoVersions: "Diff Two Versions",
      cancelDiff: "Cancel Diff",
      showDiff: "Show Diff",
      clear: "Clear",
      selectForDiff: "Select for Diff",
      deselect: "Deselect",
      replaceSelection: "Replace Selection",
      diffNewer: "1 (newer)",
      diffOlder: "2 (older)",
      diffWithCurrent: "Diff with Current",
      currentFile: "Current file",
      restore: "Restore",
      preview: "Preview",
      moreActions: "More actions",
      delete: "Delete",
      deleteConfirm: "Delete?",
      yes: "Yes",
      no: "No",
      versionDeleted: "Version deleted.",
      failedDeleteVersion: "Failed to delete version.",
      failedLoadSnapshot: "Failed to load snapshot.",
      failedLoadSnapshotContent: "Failed to load snapshot content.",
      versionRestored: "Version restored. Current state backed up below.",
      renameVersion: "Rename version",
      labelUpdated: "Label updated.",
      failedUpdateLabel: "Failed to update label.",
      save: "Save",
      cancel: "Cancel",
      restoreThisVersion: "Restore This Version",
      close: "Close",
      lastUnsavedVersion: "Last Unsaved Version",
      autoSavedOnRestore: "Auto-saved on restore: {date} {time}",
      restoreBackup: "Restore Backup",
      backupRestored: "Backup restored.",
      failedLoadBackup: "Failed to load backup.",
      backupDeleted: "Backup deleted.",
      failedDeleteBackup: "Failed to delete backup.",
      deleteBackup: "Delete backup?",
      restoreVersion: "Restore version",
      loadingVersions: "Loading versions\u2026",
      noSavedVersionsYet: "No saved versions yet.",
      unnamed: "(unnamed)",
      versionRestoredDot: "Version restored.",
      failedLoadSnapshotDot: "Failed to load selected snapshot.",
      diff: "Diff",
      noDifferences: "No differences",
      added: "+{n} added",
      removed: "-{n} removed",
      unchangedLinesShow: "\u25BE  {n} unchanged lines (click to show)  \u25BE",
      unchangedLinesHide: "\u25B4  {n} unchanged lines (click to hide)  \u25B4",
      settingsTitle: "Save History Settings",
      language: "Language",
      languageDesc: "Interface language for the plugin.",
      groupVersionsBy: "Group versions by",
      groupVersionsDesc: "Group saved versions in the sidebar by time period.",
      snapshotFolder: "Snapshot folder",
      snapshotFolderDesc: `Folder in the vault root where versions are stored. Start with "." to hide it from Obsidian's file explorer.`,
      snapshotFolderRenamed: "Folder renamed successfully.",
      snapshotFolderRenameFailed: "Failed to rename folder.",
      versionPreview: "Version Preview",
      noPreviewLoaded: "No preview loaded.",
      noChangesDetected: "Version not saved \u2014 no changes detected."
    };
    ru = {
      cmdSaveNow: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E",
      cmdSaveNowDesc: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0444\u0430\u0439\u043B\u0430",
      cmdRestore: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E\u2026",
      cmdRestoreDesc: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E",
      cmdOpenSidebar: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u043E\u043A\u043E\u0432\u0443\u044E \u043F\u0430\u043D\u0435\u043B\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u0438",
      cmdRestoreLastBackup: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u043D\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E",
      cmdRestoreLastBackupDesc: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0431\u044D\u043A\u0430\u043F \u043F\u0435\u0440\u0435\u0434 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0434\u043B\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0444\u0430\u0439\u043B\u0430",
      noFileOpenSave: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 markdown (.md) \u0444\u0430\u0439\u043B, \u0447\u0442\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E.",
      noFileOpenRestore: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 markdown (.md) \u0444\u0430\u0439\u043B, \u0447\u0442\u043E\u0431\u044B \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E.",
      viewTitle: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0444\u0430\u0439\u043B\u0430",
      noActiveFile: "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E markdown \u0444\u0430\u0439\u043B\u0430.",
      fileLabel: "\u0424\u0430\u0439\u043B: {name}",
      saveVersionNow: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E",
      versionSaved: "\u0412\u0435\u0440\u0441\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.",
      noSavedVersions: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0432\u0435\u0440\u0441\u0438\u0439.",
      groupNone: "\u0411\u0435\u0437 \u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0438",
      groupDay: "\u041F\u043E \u0434\u043D\u044F\u043C",
      groupWeek: "\u041F\u043E \u043D\u0435\u0434\u0435\u043B\u044F\u043C",
      groupMonth: "\u041F\u043E \u043C\u0435\u0441\u044F\u0446\u0430\u043C",
      groupYear: "\u041F\u043E \u0433\u043E\u0434\u0430\u043C",
      diffTwoVersions: "\u0421\u0440\u0430\u0432\u043D\u0438\u0442\u044C \u0434\u0432\u0435 \u0432\u0435\u0440\u0441\u0438\u0438",
      cancelDiff: "\u041E\u0442\u043C\u0435\u043D\u0430",
      showDiff: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0440\u0430\u0437\u043D\u0438\u0446\u0443",
      clear: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C",
      selectForDiff: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0434\u043B\u044F \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F",
      deselect: "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0431\u043E\u0440",
      replaceSelection: "\u0417\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0431\u043E\u0440",
      diffNewer: "1 (\u043D\u043E\u0432\u0435\u0435)",
      diffOlder: "2 (\u0441\u0442\u0430\u0440\u0430\u044F)",
      diffWithCurrent: "\u0421\u0440\u0430\u0432\u043D\u0438\u0442\u044C \u0441 \u0442\u0435\u043A\u0443\u0449\u0438\u043C",
      currentFile: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0444\u0430\u0439\u043B",
      restore: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C",
      preview: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
      moreActions: "\u0415\u0449\u0451 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
      delete: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      deleteConfirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C?",
      yes: "\u0414\u0430",
      no: "\u041D\u0435\u0442",
      versionDeleted: "\u0412\u0435\u0440\u0441\u0438\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u0430.",
      failedDeleteVersion: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E.",
      failedLoadSnapshot: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043D\u0438\u043C\u043E\u043A.",
      failedLoadSnapshotContent: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0441\u043D\u0438\u043C\u043A\u0430.",
      versionRestored: "\u0412\u0435\u0440\u0441\u0438\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430. \u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043D\u0438\u0436\u0435.",
      renameVersion: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u044E",
      labelUpdated: "\u041C\u0435\u0442\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430.",
      failedUpdateLabel: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043C\u0435\u0442\u043A\u0443.",
      save: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
      cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
      restoreThisVersion: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u044D\u0442\u0443 \u0432\u0435\u0440\u0441\u0438\u044E",
      close: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
      lastUnsavedVersion: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043D\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F",
      autoSavedOnRestore: "\u0410\u0432\u0442\u043E\u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0438: {date} {time}",
      restoreBackup: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432",
      backupRestored: "\u0420\u0435\u0437\u0435\u0440\u0432 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.",
      failedLoadBackup: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432.",
      backupDeleted: "\u0420\u0435\u0437\u0435\u0440\u0432 \u0443\u0434\u0430\u043B\u0451\u043D.",
      failedDeleteBackup: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432.",
      deleteBackup: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0440\u0435\u0437\u0435\u0440\u0432?",
      restoreVersion: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u0435\u0440\u0441\u0438\u0438",
      loadingVersions: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0432\u0435\u0440\u0441\u0438\u0439\u2026",
      noSavedVersionsYet: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0432\u0435\u0440\u0441\u0438\u0439.",
      unnamed: "(\u0431\u0435\u0437 \u0438\u043C\u0435\u043D\u0438)",
      versionRestoredDot: "\u0412\u0435\u0440\u0441\u0438\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.",
      failedLoadSnapshotDot: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043D\u0438\u043C\u043E\u043A.",
      diff: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435",
      noDifferences: "\u0420\u0430\u0437\u043B\u0438\u0447\u0438\u0439 \u043D\u0435\u0442",
      added: "+{n} \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E",
      removed: "-{n} \u0443\u0434\u0430\u043B\u0435\u043D\u043E",
      unchangedLinesShow: "\u25BE  {n} \u043D\u0435\u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0445 \u0441\u0442\u0440\u043E\u043A (\u043D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C)  \u25BE",
      unchangedLinesHide: "\u25B4  {n} \u043D\u0435\u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0445 \u0441\u0442\u0440\u043E\u043A (\u043D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0441\u043A\u0440\u044B\u0442\u044C)  \u25B4",
      settingsTitle: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 Save History",
      language: "\u042F\u0437\u044B\u043A",
      languageDesc: "\u042F\u0437\u044B\u043A \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043F\u043B\u0430\u0433\u0438\u043D\u0430.",
      groupVersionsBy: "\u0413\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u043A\u0430 \u0432\u0435\u0440\u0441\u0438\u0439",
      groupVersionsDesc: "\u0413\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0435\u0440\u0441\u0438\u0438 \u0432 \u0431\u043E\u043A\u043E\u0432\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438 \u043F\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430\u043C.",
      snapshotFolder: "\u041F\u0430\u043F\u043A\u0430 \u0441\u043D\u0438\u043C\u043A\u043E\u0432",
      snapshotFolderDesc: '\u041F\u0430\u043F\u043A\u0430 \u0432 \u043A\u043E\u0440\u043D\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430, \u0433\u0434\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0432\u0435\u0440\u0441\u0438\u0438. \u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441 ".", \u0447\u0442\u043E\u0431\u044B \u0441\u043A\u0440\u044B\u0442\u044C \u0435\u0451 \u0438\u0437 \u043F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A\u0430 Obsidian.',
      snapshotFolderRenamed: "\u041F\u0430\u043F\u043A\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0430.",
      snapshotFolderRenameFailed: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443.",
      versionPreview: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0432\u0435\u0440\u0441\u0438\u0438",
      noPreviewLoaded: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D.",
      noChangesDetected: "\u0412\u0435\u0440\u0441\u0438\u044F \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u2014 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u043D\u0435 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E."
    };
    translations = { en, ru };
    currentLanguage = "en";
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
    name: translate("cmdSaveNow"),
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast(translate("noFileOpenSave"));
        return;
      }
      const result = await versioning.saveNowForFile(file, "manual");
      plugin.toast(result === "saved" ? translate("versionSaved") : translate("noChangesDetected"));
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
    name: translate("cmdRestore"),
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast(translate("noFileOpenRestore"));
        return;
      }
      new RestoreVersionModal(plugin, file, versioning).open();
    }
  });
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
            active: true
          });
        }
      }
      if (leaf) {
        plugin.app.workspace.revealLeaf(leaf);
      }
    }
  });
  plugin.addCommand?.({
    id: "save-history:restore-last-backup",
    name: translate("cmdRestoreLastBackup"),
    callback: async () => {
      const file = plugin.getActiveMarkdownFile();
      if (!file) {
        plugin.toast(translate("noFileOpenRestore"));
        return;
      }
      const allSnapshots = await listSnapshotsForFile(plugin, file.path);
      const preRestoreBackup = allSnapshots.find((s) => s.reason === "pre-restore");
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
function makeDraggable(el, handle, signal) {
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
  signal?.addEventListener("abort", () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    handle.removeEventListener("mousedown", onMouseDown);
  });
}
function makeResizable(el, signal) {
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
  const onMouseDown = (e) => {
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
  resizer.addEventListener("mousedown", onMouseDown);
  signal?.addEventListener("abort", () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeEventListener("mousedown", onMouseDown);
  });
}
var import_obsidian, VIEW_TYPE_SAVE_HISTORY, SaveHistoryView, RestoreVersionModal, DiffModal;
var init_ui = __esm({
  "src/ui.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    init_storage();
    init_diff();
    init_locale();
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
        return translate("viewTitle");
      }
      getIcon() {
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
        const opts = [
          { value: "none", label: translate("groupNone") },
          { value: "day", label: translate("groupDay") },
          { value: "week", label: translate("groupWeek") },
          { value: "month", label: translate("groupMonth") },
          { value: "year", label: translate("groupYear") }
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
          const curFile = this.plugin.getActiveMarkdownFile();
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
        const snapshots = allSnapshots.filter((s) => s.reason !== "pre-restore");
        const preRestoreBackup = allSnapshots.find((s) => s.reason === "pre-restore");
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
            const curFile = this.plugin.getActiveMarkdownFile();
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
            const curFile = this.plugin.getActiveMarkdownFile();
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
        item.style.position = "relative";
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
            const dotsBtn = nameRow.createEl("span", { text: "\u22EE" });
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
            const addMenuItem = (text, onClick) => {
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
            const onOutsideMouseDown = (e) => {
              if (!dropdown.contains(e.target) && !dotsBtn.contains(e.target)) {
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
              const curFile = this.plugin.getActiveMarkdownFile();
              if (!curFile) return;
              const snapContent = await readSnapshotContent(this.plugin, snap.filePath);
              if (!snapContent) {
                this.plugin.toast(translate("failedLoadSnapshot"));
                return;
              }
              const currentContent = await this.plugin.app.vault.read(curFile);
              const currentSnap = {
                timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                reason: translate("currentFile"),
                filePath: curFile.path
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
          const okBtn = controls.createEl("span", { text: "\u2714\uFE0F" });
          okBtn.style.cursor = "pointer";
          okBtn.title = translate("save");
          okBtn.onclick = async (ev) => {
            ev.stopPropagation();
            await saveLabel();
          };
          const cancelBtn = controls.createEl("span", { text: "\u274C" });
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
            text: isSelected ? translate("deselect") : this.diffSelection.length < 2 ? translate("selectForDiff") : translate("replaceSelection")
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
          const curFile = this.plugin.getActiveMarkdownFile();
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
          const curFile = this.plugin.getActiveMarkdownFile();
          if (!curFile) return;
          const restored = await readSnapshotContent(this.plugin, snap.filePath);
          if (!restored) return;
          const previewModal = new import_obsidian.Modal(this.plugin.app);
          const previewAbort = new AbortController();
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
      cleanupDropdowns() {
        document.querySelectorAll("[data-save-history-dropdown]").forEach((el) => el.remove());
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
      async refresh() {
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
      async restoreSnapshot(snap) {
        const restored = await readSnapshotContent(this.plugin, snap.filePath);
        if (!restored) {
          this.plugin.toast(translate("failedLoadSnapshotDot"));
          return;
        }
        await this.versioning.restoreFromSnapshot(this.file, restored);
        this.plugin.toast(translate("versionRestoredDot"));
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
        this.abortController = new AbortController();
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
        renderRows().catch(() => {
        });
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
    };
  }
});

// src/settings.ts
var import_obsidian2, SaveHistorySettingTab;
var init_settings = __esm({
  "src/settings.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    init_ui();
    init_locale();
    init_storage();
    SaveHistorySettingTab = class extends import_obsidian2.PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      display() {
        const el = this.containerEl;
        el.empty();
        const wrapper = el.createDiv();
        wrapper.style.padding = "12px";
        const header = wrapper.createEl("h2", { text: translate("settingsTitle") });
        header.style.marginBottom = "16px";
        wrapper.createDiv({ text: translate("language"), cls: "setting-item-name" });
        const langDesc = wrapper.createDiv({
          text: translate("languageDesc"),
          cls: "setting-item-description"
        });
        langDesc.style.fontSize = "0.85em";
        langDesc.style.color = "var(--text-muted)";
        langDesc.style.marginBottom = "6px";
        const langSelect = wrapper.createEl("select");
        langSelect.style.marginBottom = "16px";
        langSelect.style.padding = "4px 8px";
        langSelect.style.fontSize = "0.9em";
        const enOpt = langSelect.createEl("option", { text: "English" });
        enOpt.value = "en";
        const ruOpt = langSelect.createEl("option", { text: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" });
        ruOpt.value = "ru";
        langSelect.value = this.plugin.settings.language;
        langSelect.onchange = async () => {
          const lang = langSelect.value;
          this.plugin.settings.language = lang;
          setLanguage(lang);
          await this.plugin.saveSettings();
          this.display();
          this.refreshSidebarViews();
        };
        wrapper.createDiv({ text: translate("groupVersionsBy"), cls: "setting-item-name" });
        const groupDesc = wrapper.createDiv({
          text: translate("groupVersionsDesc"),
          cls: "setting-item-description"
        });
        groupDesc.style.fontSize = "0.85em";
        groupDesc.style.color = "var(--text-muted)";
        groupDesc.style.marginBottom = "6px";
        const groupSelect = wrapper.createEl("select");
        groupSelect.style.marginBottom = "16px";
        groupSelect.style.padding = "4px 8px";
        groupSelect.style.fontSize = "0.9em";
        const noneOpt = groupSelect.createEl("option", { text: translate("groupNone") });
        noneOpt.value = "none";
        const dayOpt = groupSelect.createEl("option", { text: translate("groupDay") });
        dayOpt.value = "day";
        const weekOpt = groupSelect.createEl("option", { text: translate("groupWeek") });
        weekOpt.value = "week";
        const monthOpt = groupSelect.createEl("option", { text: translate("groupMonth") });
        monthOpt.value = "month";
        const yearOpt = groupSelect.createEl("option", { text: translate("groupYear") });
        yearOpt.value = "year";
        groupSelect.value = this.plugin.settings.groupBy;
        groupSelect.onchange = async () => {
          this.plugin.settings.groupBy = groupSelect.value;
          await this.plugin.saveSettings();
          this.refreshSidebarViews();
        };
        wrapper.createDiv({ text: translate("snapshotFolder"), cls: "setting-item-name" });
        const folderDesc = wrapper.createDiv({
          text: translate("snapshotFolderDesc"),
          cls: "setting-item-description"
        });
        folderDesc.style.fontSize = "0.85em";
        folderDesc.style.color = "var(--text-muted)";
        folderDesc.style.marginBottom = "6px";
        const folderRow = wrapper.createDiv();
        folderRow.style.display = "flex";
        folderRow.style.gap = "8px";
        folderRow.style.alignItems = "center";
        folderRow.style.marginBottom = "16px";
        const folderInput = folderRow.createEl("input");
        folderInput.type = "text";
        folderInput.value = this.plugin.settings.snapshotFolder;
        folderInput.style.flex = "1";
        folderInput.style.padding = "4px 8px";
        folderInput.style.fontSize = "0.9em";
        const folderSaveBtn = folderRow.createEl("button", { text: translate("save") });
        folderSaveBtn.style.flexShrink = "0";
        folderSaveBtn.onclick = async () => {
          const newName = folderInput.value.trim();
          if (!newName) return;
          if (newName === this.plugin.settings.snapshotFolder) return;
          if (/[<>:"|?*]/.test(newName) || newName.startsWith("/") || newName.endsWith("/") || newName.includes("..")) {
            this.plugin.toast(translate("snapshotFolderRenameFailed"));
            return;
          }
          const oldName = this.plugin.settings.snapshotFolder;
          const success = await renameSnapshotFolder(this.plugin.app.vault.adapter, oldName, newName);
          if (success) {
            this.plugin.settings.snapshotFolder = newName;
            await this.plugin.saveSettings();
            this.plugin.toast(translate("snapshotFolderRenamed"));
            this.refreshSidebarViews();
          } else {
            this.plugin.toast(translate("snapshotFolderRenameFailed"));
          }
        };
      }
      refreshSidebarViews() {
        const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
        for (const leaf of leaves) {
          if (leaf.view instanceof SaveHistoryView) {
            leaf.view.refresh();
          }
        }
      }
    };
  }
});

// src/main.ts
var import_obsidian3, DEFAULT_SETTINGS, SaveHistoryPlugin;
var init_main = __esm({
  "src/main.ts"() {
    "use strict";
    import_obsidian3 = require("obsidian");
    init_versioning();
    init_ui();
    init_settings();
    init_locale();
    init_storage();
    DEFAULT_SETTINGS = {
      groupBy: "day",
      collapsedGroups: {},
      language: "en",
      snapshotFolder: ".versions(SH)"
    };
    SaveHistoryPlugin = class extends import_obsidian3.Plugin {
      constructor() {
        super(...arguments);
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
        this.addSettingTab(new SaveHistorySettingTab(this.app, this));
        this.registerEvent(
          this.app.vault.on("rename", async (file, oldPath) => {
            if (!(file instanceof import_obsidian3.TFile) || file.extension !== "md") return;
            const oldDir = getSnapshotDirPath(this, oldPath);
            const newDir = getSnapshotDirPath(this, file.path);
            await renameSnapshotFolder(this.app.vault.adapter, oldDir, newDir);
            const parentDir = oldDir.substring(0, oldDir.lastIndexOf("/"));
            await removeEmptyParentDirs(this, parentDir);
          })
        );
        this.registerEvent(
          this.app.vault.on("delete", async (file) => {
            if (!(file instanceof import_obsidian3.TFile) || file.extension !== "md") return;
            await deleteSnapshotDirForFile(this, file.path);
          })
        );
      }
      onunload() {
      }
      async loadSettings() {
        const data = await this.loadData?.();
        if (data) {
          this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        }
        setLanguage(this.settings.language);
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
        new import_obsidian3.Notice(message);
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
