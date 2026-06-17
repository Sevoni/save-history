export type Language = "en" | "ru";

type TranslationKeys = {
  // Commands
  cmdSaveNow: string;
  cmdSaveNowDesc: string;
  cmdRestore: string;
  cmdRestoreDesc: string;
  cmdOpenSidebar: string;
  cmdRestoreLastBackup: string;
  cmdRestoreLastBackupDesc: string;
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
  moreActions: string;
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
  language: string;
  languageDesc: string;
  groupVersionsBy: string;
  groupVersionsDesc: string;
  snapshotFolder: string;
  snapshotFolderDesc: string;
  snapshotFolderRenamed: string;
  snapshotFolderRenameFailed: string;

  // Preview view
  versionPreview: string;
  noPreviewLoaded: string;
  noChangesDetected: string;
};

const en: TranslationKeys = {
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
  snapshotFolderDesc: "Folder in the vault root where versions are stored. Start with \".\" to hide it from Obsidian's file explorer.",
  snapshotFolderRenamed: "Folder renamed successfully.",
  snapshotFolderRenameFailed: "Failed to rename folder.",

  versionPreview: "Version Preview",
  noPreviewLoaded: "No preview loaded.",
  noChangesDetected: "Version not saved — no changes detected.",
};

const ru: TranslationKeys = {
  cmdSaveNow: "Сохранить версию",
  cmdSaveNowDesc: "Сохранить версию текущего файла",
  cmdRestore: "Восстановить версию\u2026",
  cmdRestoreDesc: "Восстановить сохранённую версию",
  cmdOpenSidebar: "Открыть боковую панель истории",
  cmdRestoreLastBackup: "Восстановить последнюю несохранённую версию",
  cmdRestoreLastBackupDesc: "Восстановить последний бэкап перед восстановлением для текущего файла",
  noFileOpenSave: "Откройте markdown (.md) файл, чтобы сохранить версию.",
  noFileOpenRestore: "Откройте markdown (.md) файл, чтобы восстановить версию.",

  viewTitle: "История файла",
  noActiveFile: "Нет активного markdown файла.",
  fileLabel: "Файл: {name}",
  saveVersionNow: "Сохранить версию",
  versionSaved: "Версия сохранена.",
  noSavedVersions: "Пока нет сохранённых версий.",

  groupNone: "Без группировки",
  groupDay: "По дням",
  groupWeek: "По неделям",
  groupMonth: "По месяцам",
  groupYear: "По годам",

  diffTwoVersions: "Сравнить две версии",
  cancelDiff: "Отмена",
  showDiff: "Показать разницу",
  clear: "Очистить",
  selectForDiff: "Выбрать для сравнения",
  deselect: "Снять выбор",
  replaceSelection: "Заменить выбор",
  diffNewer: "1 (новее)",
  diffOlder: "2 (старая)",
  diffWithCurrent: "Сравнить с текущим",
  currentFile: "Текущий файл",

  restore: "Восстановить",
  preview: "Просмотр",
  moreActions: "Ещё действия",
  delete: "Удалить",
  deleteConfirm: "Удалить?",
  yes: "Да",
  no: "Нет",
  versionDeleted: "Версия удалена.",
  failedDeleteVersion: "Не удалось удалить версию.",
  failedLoadSnapshot: "Не удалось загрузить снимок.",
  failedLoadSnapshotContent: "Не удалось загрузить содержимое снимка.",
  versionRestored: "Версия восстановлена. Текущее состояние сохранено ниже.",
  renameVersion: "Переименовать версию",
  labelUpdated: "Метка обновлена.",
  failedUpdateLabel: "Не удалось обновить метку.",
  save: "Сохранить",
  cancel: "Отмена",

  restoreThisVersion: "Восстановить эту версию",
  close: "Закрыть",

  lastUnsavedVersion: "Последняя несохранённая версия",
  autoSavedOnRestore: "Автосохранение при восстановлении: {date} {time}",
  restoreBackup: "Восстановить резерв",
  backupRestored: "Резерв восстановлен.",
  failedLoadBackup: "Не удалось загрузить резерв.",
  backupDeleted: "Резерв удалён.",
  failedDeleteBackup: "Не удалось удалить резерв.",
  deleteBackup: "Удалить резерв?",

  restoreVersion: "Восстановление версии",
  loadingVersions: "Загрузка версий\u2026",
  noSavedVersionsYet: "Пока нет сохранённых версий.",
  unnamed: "(без имени)",
  versionRestoredDot: "Версия восстановлена.",
  failedLoadSnapshotDot: "Не удалось загрузить снимок.",

  diff: "Сравнение",
  noDifferences: "Различий нет",
  added: "+{n} добавлено",
  removed: "-{n} удалено",
  unchangedLinesShow: "\u25BE  {n} неизменённых строк (нажмите, чтобы показать)  \u25BE",
  unchangedLinesHide: "\u25B4  {n} неизменённых строк (нажмите, чтобы скрыть)  \u25B4",

  settingsTitle: "Настройки Save History",
  language: "Язык",
  languageDesc: "Язык интерфейса плагина.",
  groupVersionsBy: "Группировка версий",
  groupVersionsDesc: "Группировать версии в боковой панели по периодам.",
  snapshotFolder: "Папка снимков",
  snapshotFolderDesc: "Папка в корне хранилища, где хранятся версии. Начните с \".\", чтобы скрыть её из проводника Obsidian.",
  snapshotFolderRenamed: "Папка успешно переименована.",
  snapshotFolderRenameFailed: "Не удалось переименовать папку.",

  versionPreview: "Просмотр версии",
  noPreviewLoaded: "Просмотр не загружен.",
  noChangesDetected: "Версия не сохранена — изменений не обнаружено.",
};

const translations: Record<Language, TranslationKeys> = { en, ru };

let currentLanguage: Language = "en";

export function setLanguage(lang: Language) {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function translate(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
  let str = translations[currentLanguage][key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
