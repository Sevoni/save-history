export type Language = "en" | "ru";

type TranslationKeys = {
  // Commands
  cmdSaveNow: string;
  cmdSaveNowDesc: string;
  cmdRestore: string;
  cmdRestoreDesc: string;
  cmdOpenSidebar: string;
  noFileOpenSave: string;
  noFileOpenRestore: string;

  // Sidebar
  viewTitle: string;
  noActiveFile: string;
  fileLabel: string;
  saveVersionNow: string;
  versionSaved: string;
  noSavedVersions: string;

  // Group by
  groupNone: string;
  groupDay: string;
  groupWeek: string;
  groupMonth: string;
  groupYear: string;

  // Diff mode
  diffTwoVersions: string;
  cancelDiff: string;
  showDiff: string;
  clear: string;
  selectForDiff: string;
  deselect: string;
  replaceSelection: string;
  diffNewer: string;
  diffOlder: string;
  diffWithCurrent: string;
  currentFile: string;

  // Snapshot item
  restore: string;
  preview: string;
  delete: string;
  deleteConfirm: string;
  yes: string;
  no: string;
  versionDeleted: string;
  failedDeleteVersion: string;
  failedLoadSnapshot: string;
  failedLoadSnapshotContent: string;
  versionRestored: string;
  renameVersion: string;
  labelUpdated: string;
  failedUpdateLabel: string;
  save: string;
  cancel: string;

  // Preview modal
  restoreThisVersion: string;
  close: string;

  // Pre-restore backup
  lastUnsavedVersion: string;
  autoSavedOnRestore: string;
  restoreBackup: string;
  backupRestored: string;
  failedLoadBackup: string;
  backupDeleted: string;
  failedDeleteBackup: string;
  deleteBackup: string;

  // Restore modal
  restoreVersion: string;
  loadingVersions: string;
  noSavedVersionsYet: string;
  unnamed: string;
  versionRestoredDot: string;
  failedLoadSnapshotDot: string;

  // Diff modal
  diff: string;
  noDifferences: string;
  added: string;
  removed: string;
  unchangedLinesShow: string;
  unchangedLinesHide: string;

  // Settings
  settingsTitle: string;
  diffDisplayStyle: string;
  diffDisplayDesc: string;
  unifiedInline: string;
  sideBySide: string;
  previewOpenStyle: string;
  previewOpenDesc: string;
  customView: string;
  tempFile: string;
  groupVersionsBy: string;
  groupVersionsDesc: string;
  language: string;
  languageDesc: string;

  // Preview view (unused but defined)
  versionPreview: string;
  noPreviewLoaded: string;
};

const en: TranslationKeys = {
  cmdSaveNow: "Save version now",
  cmdSaveNowDesc: "Save a version of the current file",
  cmdRestore: "Restore version\u2026",
  cmdRestoreDesc: "Restore a saved version",
  cmdOpenSidebar: "Open history sidebar",
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
  diffDisplayStyle: "Diff display style",
  diffDisplayDesc: "Choose how version differences are displayed.",
  unifiedInline: "Unified (inline)",
  sideBySide: "Side-by-side",
  previewOpenStyle: "Preview open style",
  previewOpenDesc: "How to open a version in a new pane. Custom view is cleaner; temp file uses Obsidian's native editor.",
  customView: "Custom View",
  tempFile: "Temp File",
  groupVersionsBy: "Group versions by",
  groupVersionsDesc: "Group saved versions in the sidebar by time period.",
  language: "Language",
  languageDesc: "Interface language for the plugin.",

  versionPreview: "Version Preview",
  noPreviewLoaded: "No preview loaded.",
};

const ru: TranslationKeys = {
  cmdSaveNow: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e",
  cmdSaveNowDesc: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0444\u0430\u0439\u043b\u0430",
  cmdRestore: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e\u2026",
  cmdRestoreDesc: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e",
  cmdOpenSidebar: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0431\u043e\u043a\u043e\u0432\u0443\u044e \u043f\u0430\u043d\u0435\u043b\u044c \u0438\u0441\u0442\u043e\u0440\u0438\u0438",
  noFileOpenSave: "\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 markdown (.md) \u0444\u0430\u0439\u043b, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e.",
  noFileOpenRestore: "\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 markdown (.md) \u0444\u0430\u0439\u043b, \u0447\u0442\u043e\u0431\u044b \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e.",

  viewTitle: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0444\u0430\u0439\u043b\u0430",
  noActiveFile: "\u041d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e markdown \u0444\u0430\u0439\u043b\u0430.",
  fileLabel: "\u0424\u0430\u0439\u043b: {name}",
  saveVersionNow: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e",
  versionSaved: "\u0412\u0435\u0440\u0441\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430.",
  noSavedVersions: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u0432\u0435\u0440\u0441\u0438\u0439.",

  groupNone: "\u0411\u0435\u0437 \u0433\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u043a\u0438",
  groupDay: "\u041f\u043e \u0434\u043d\u044f\u043c",
  groupWeek: "\u041f\u043e \u043d\u0435\u0434\u0435\u043b\u044f\u043c",
  groupMonth: "\u041f\u043e \u043c\u0435\u0441\u044f\u0446\u0430\u043c",
  groupYear: "\u041f\u043e \u0433\u043e\u0434\u0430\u043c",

  diffTwoVersions: "\u0421\u0440\u0430\u0432\u043d\u0438\u0442\u044c \u0434\u0432\u0435 \u0432\u0435\u0440\u0441\u0438\u0438",
  cancelDiff: "\u041e\u0442\u043c\u0435\u043d\u0430",
  showDiff: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0440\u0430\u0437\u043d\u0438\u0446\u0443",
  clear: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c",
  selectForDiff: "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0434\u043b\u044f \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f",
  deselect: "\u0421\u043d\u044f\u0442\u044c \u0432\u044b\u0431\u043e\u0440",
  replaceSelection: "\u0417\u0430\u043c\u0435\u043d\u0438\u0442\u044c \u0432\u044b\u0431\u043e\u0440",
  diffNewer: "1 (\u043d\u043e\u0432\u0435\u0435)",
  diffOlder: "2 (\u0441\u0442\u0430\u0440\u0430\u044f)",
  diffWithCurrent: "\u0421\u0440\u0430\u0432\u043d\u0438\u0442\u044c \u0441 \u0442\u0435\u043a\u0443\u0449\u0438\u043c",
  currentFile: "\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0444\u0430\u0439\u043b",

  restore: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c",
  preview: "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440",
  delete: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
  deleteConfirm: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c?",
  yes: "\u0414\u0430",
  no: "\u041d\u0435\u0442",
  versionDeleted: "\u0412\u0435\u0440\u0441\u0438\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0430.",
  failedDeleteVersion: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e.",
  failedLoadSnapshot: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043d\u0438\u043c\u043e\u043a.",
  failedLoadSnapshotContent: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435 \u0441\u043d\u0438\u043c\u043a\u0430.",
  versionRestored: "\u0412\u0435\u0440\u0441\u0438\u044f \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430. \u0422\u0435\u043a\u0443\u0449\u0435\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u043d\u0438\u0436\u0435.",
  renameVersion: "\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e",
  labelUpdated: "\u041c\u0435\u0442\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430.",
  failedUpdateLabel: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043c\u0435\u0442\u043a\u0443.",
  save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
  cancel: "\u041e\u0442\u043c\u0435\u043d\u0430",

  restoreThisVersion: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u044d\u0442\u0443 \u0432\u0435\u0440\u0441\u0438\u044e",
  close: "\u0417\u0430\u043a\u0440\u044b\u0442\u044c",

  lastUnsavedVersion: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f",
  autoSavedOnRestore: "\u0410\u0432\u0442\u043e\u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u043f\u0440\u0438 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0438: {date} {time}",
  restoreBackup: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0440\u0435\u0437\u0435\u0440\u0432",
  backupRestored: "\u0420\u0435\u0437\u0435\u0440\u0432 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d.",
  failedLoadBackup: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0440\u0435\u0437\u0435\u0440\u0432.",
  backupDeleted: "\u0420\u0435\u0437\u0435\u0440\u0432 \u0443\u0434\u0430\u043b\u0435\u043d.",
  failedDeleteBackup: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u0435\u0437\u0435\u0440\u0432.",
  deleteBackup: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u0435\u0437\u0435\u0440\u0432?",

  restoreVersion: "\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0432\u0435\u0440\u0441\u0438\u0438",
  loadingVersions: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0432\u0435\u0440\u0441\u0438\u0439\u2026",
  noSavedVersionsYet: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0445 \u0432\u0435\u0440\u0441\u0438\u0439.",
  unnamed: "(\u0431\u0435\u0437 \u0438\u043c\u0435\u043d\u0438)",
  versionRestoredDot: "\u0412\u0435\u0440\u0441\u0438\u044f \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0430.",
  failedLoadSnapshotDot: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043d\u0438\u043c\u043e\u043a.",

  diff: "\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435",
  noDifferences: "\u0420\u0430\u0437\u043b\u0438\u0447\u0438\u0439 \u043d\u0435\u0442",
  added: "+{n} \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e",
  removed: "-{n} \u0443\u0434\u0430\u043b\u0435\u043d\u043e",
  unchangedLinesShow: "\u25BE  {n} \u043d\u0435\u0438\u0437\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0445 \u0441\u0442\u0440\u043e\u043a (\u043d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c)  \u25BE",
  unchangedLinesHide: "\u25B4  {n} \u043d\u0435\u0438\u0437\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0445 \u0441\u0442\u0440\u043e\u043a (\u043d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0441\u043a\u0440\u044b\u0442\u044c)  \u25B4",

  settingsTitle: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 Save History",
  diffDisplayStyle: "\u0421\u0442\u0438\u043b\u044c \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0440\u0430\u0437\u043d\u0438\u0446",
  diffDisplayDesc: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435, \u043a\u0430\u043a \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0442\u044c\u0441\u044f \u0440\u0430\u0437\u043b\u0438\u0447\u0438\u044f \u043c\u0435\u0436\u0434\u0443 \u0432\u0435\u0440\u0441\u0438\u044f\u043c\u0438.",
  unifiedInline: "\u0421\u043f\u043b\u043e\u0448\u043d\u044b\u0439 (\u0432 \u0441\u0442\u0440\u043e\u043a\u0443)",
  sideBySide: "\u0411\u043e\u043a \u043e \u0431\u043e\u043a",
  previewOpenStyle: "\u0421\u0442\u0438\u043b\u044c \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430",
  previewOpenDesc: "\u041a\u0430\u043a \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u044e \u0432 \u043d\u043e\u0432\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438. \u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0447\u0438\u0449\u0435; \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0432\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440 Obsidian.",
  customView: "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440",
  tempFile: "\u0412\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0439 \u0444\u0430\u0439\u043b",
  groupVersionsBy: "\u0413\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u043a\u0430 \u0432\u0435\u0440\u0441\u0438\u0439",
  groupVersionsDesc: "\u0413\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u0435\u0440\u0441\u0438\u0438 \u0432 \u0431\u043e\u043a\u043e\u0432\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438 \u043f\u043e \u043f\u0435\u0440\u0438\u043e\u0434\u0430\u043c.",
  language: "\u042f\u0437\u044b\u043a",
  languageDesc: "\u042f\u0437\u044b\u043a \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u043f\u043b\u0430\u0433\u0438\u043d\u0430.",

  versionPreview: "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0432\u0435\u0440\u0441\u0438\u0438",
  noPreviewLoaded: "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d.",
};

const translations: Record<Language, TranslationKeys> = { en, ru };

let currentLang: Language = "en";

export function setLanguage(lang: Language) {
  currentLang = lang;
}

export function t(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
  let str = translations[currentLang][key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
