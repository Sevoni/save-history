export type Language = "system" | "en" | "ru" | "es";

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

  // Bulk delete
  bulkDeleteSelected: string;
  bulkDeleteConfirm: string;
  bulkDeleteSuccess: string;
  bulkDeleteFailed: string;
  selectAll: string;
  deselectAll: string;
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
  viewRaw: string;
  viewRendered: string;
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

  // Export / Import
  exportVersion: string;
  exportAllVersions: string;
  exportSuccess: string;
  exportAllSuccess: string;
  exportNoVersions: string;
  importVersions: string;
  importSuccess: string;
  importNoFiles: string;

  // Export folder
  exportFolder: string;
  exportFolderDesc: string;
  exportFolderRenamed: string;
  exportFolderRenameFailed: string;

  // Diff modal
  diff: string;
  noDifferences: string;
  added: string;
  removed: string;
  changed: string;
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

  // Autosave
  autosaveInterval: string;
  autosaveIntervalDesc: string;
  autosaveOnTabClose: string;
  autosaveOnTabCloseDesc: string;
  autosaveVersionSaved: string;
  maxAutosaveVersions: string;
  maxAutosaveVersionsDesc: string;
  allowedExtensions: string;
  allowedExtensionsDesc: string;
  settings: string;
  on: string;
  off: string;
  minutes: string;
  useGlobal: string;
  unlimited: string;
  resetToGlobal: string;
  langSystem: string;

  // Favorites
  addToFavorites: string;
  removeFromFavorites: string;

  // Search
  searchSnapshotsCmd: string;
  searchSnapshotsCmdDesc: string;
  searchInputPlaceholder: string;
  searchNoResults: string;
  searchResultsCount: string;
  searchLoading: string;
  searchCurrentFile: string;
  searchOtherFiles: string;
};

const en: TranslationKeys = {
  cmdSaveNow: "Save version now",
  cmdSaveNowDesc: "Save a version of the current file",
  cmdRestore: "Restore version\u2026",
  cmdRestoreDesc: "Restore a saved version",
  cmdOpenSidebar: "Open history sidebar",
  cmdRestoreLastBackup: "Restore last unsaved version",
  cmdRestoreLastBackupDesc: "Restore the last pre-restore backup for the current file",
  noFileOpenSave: "Open a file to save a version.",
  noFileOpenRestore: "Open a file to restore a version.",

  viewTitle: "File History",
  noActiveFile: "No active file.",
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

  bulkDeleteSelected: "Delete Selected",
  bulkDeleteConfirm: "Delete selected versions?",
  bulkDeleteSuccess: "{n} version(s) deleted.",
  bulkDeleteFailed: "Failed to delete some versions.",
  selectAll: "Select All",
  deselectAll: "Deselect All",
  failedLoadSnapshot: "Failed to load snapshot.",
  failedLoadSnapshotContent: "Failed to load snapshot content.",
  versionRestored: "Version restored. Current state backed up below.",
  renameVersion: "Rename version",
  labelUpdated: "Label updated.",
  failedUpdateLabel: "Failed to update label.",
  save: "Save",
  cancel: "Cancel",

  restoreThisVersion: "Restore This Version",
  viewRaw: "View Raw",
  viewRendered: "View Rendered",
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

  exportVersion: "Export version",
  exportAllVersions: "Export all versions",
  exportSuccess: "Version exported.",
  exportAllSuccess: "All versions exported to {path}.",
  exportNoVersions: "No versions to export.",
  importVersions: "Import versions\u2026",
  importSuccess: "Versions imported.",
  importNoFiles: "No files selected.",

  exportFolder: "Export folder",
  exportFolderDesc: "Folder in the vault where versions are exported when the browser folder picker is unavailable.",
  exportFolderRenamed: "Export folder renamed successfully.",
  exportFolderRenameFailed: "Failed to rename export folder.",

  diff: "Diff",
  noDifferences: "No differences",
  added: "+{n} added",
  removed: "-{n} removed",
  changed: "~{n} changed",
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

  autosaveInterval: "Autosave interval (min)",
  autosaveIntervalDesc: "Automatically save a version every N minutes. Set to 0 to disable.",
  autosaveOnTabClose: "Autosave on tab close",
  autosaveOnTabCloseDesc: "Save a version when the file tab is closed.",
  autosaveVersionSaved: "Auto-saved version.",
  maxAutosaveVersions: "Max autosave versions",
  maxAutosaveVersionsDesc: "Maximum number of autosaved versions per file. 0 = unlimited.",
  allowedExtensions: "Allowed file extensions",
  allowedExtensionsDesc: "Space or comma separated extensions. .md is always included. Example: json css js html",
  settings: "Settings",
  on: "On",
  off: "Off",
  minutes: "min",
  useGlobal: "Use global",
  unlimited: "Unlimited",
  resetToGlobal: "Reset to global settings",
  langSystem: "System language",

  searchSnapshotsCmd: "Search all versions",
  searchSnapshotsCmdDesc: "Search across all saved versions",
  searchInputPlaceholder: "Search version content, filename, label\u2026",
  searchNoResults: "No results found",
  searchResultsCount: "{n} result(s)",
  searchLoading: "Searching\u2026",
  searchCurrentFile: "Current file",
  searchOtherFiles: "Other files",

  addToFavorites: "Add to favorites",
  removeFromFavorites: "Remove from favorites",
};

const ru: TranslationKeys = {
  cmdSaveNow: "Сохранить версию",
  cmdSaveNowDesc: "Сохранить версию текущего файла",
  cmdRestore: "Восстановить версию\u2026",
  cmdRestoreDesc: "Восстановить сохранённую версию",
  cmdOpenSidebar: "Открыть боковую панель истории",
  cmdRestoreLastBackup: "Восстановить последнюю несохранённую версию",
  cmdRestoreLastBackupDesc: "Восстановить последний бэкап перед восстановлением для текущего файла",
  noFileOpenSave: "Откройте файл, чтобы сохранить версию.",
  noFileOpenRestore: "Откройте файл, чтобы восстановить версию.",

  viewTitle: "История файла",
  noActiveFile: "Нет активного файла.",
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

  bulkDeleteSelected: "Удалить выбранные",
  bulkDeleteConfirm: "Удалить выбранные версии?",
  bulkDeleteSuccess: "Удалено версий: {n}.",
  bulkDeleteFailed: "Не удалось удалить некоторые версии.",
  selectAll: "Выбрать все",
  deselectAll: "Снять выбор",
  failedLoadSnapshot: "Не удалось загрузить снимок.",
  failedLoadSnapshotContent: "Не удалось загрузить содержимое снимка.",
  versionRestored: "Версия восстановлена. Текущее состояние сохранено ниже.",
  renameVersion: "Переименовать версию",
  labelUpdated: "Метка обновлена.",
  failedUpdateLabel: "Не удалось обновить метку.",
  save: "Сохранить",
  cancel: "Отмена",

  restoreThisVersion: "Восстановить эту версию",
  viewRaw: "Исходник",
  viewRendered: "Просмотр",
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

  exportVersion: "Экспорт версии",
  exportAllVersions: "Экспорт всех версий",
  exportSuccess: "Версия экспортирована.",
  exportAllSuccess: "Все версии экспортированы в {path}.",
  exportNoVersions: "Нет версий для экспорта.",
  importVersions: "Импорт версий\u2026",
  importSuccess: "Версии импортированы.",
  importNoFiles: "Файлы не выбраны.",

  exportFolder: "Папка экспорта",
  exportFolderDesc: "Папка в хранилище, куда экспортируются версии, если выбор папки браузером недоступен.",
  exportFolderRenamed: "Папка экспорта успешно переименована.",
  exportFolderRenameFailed: "Не удалось переименовать папку экспорта.",

  diff: "Сравнение",
  noDifferences: "Различий нет",
  added: "+{n} добавлено",
  removed: "-{n} удалено",
  changed: "~{n} изменено",
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

  autosaveInterval: "Интервал автосохранения (мин)",
  autosaveIntervalDesc: "Автоматически сохранять версию каждые N минут. 0 — отключить.",
  autosaveOnTabClose: "Автосохранение при закрытии вкладки",
  autosaveOnTabCloseDesc: "Сохранять версию при закрытии вкладки с файлом.",
  autosaveVersionSaved: "Автосохранённая версия.",
  maxAutosaveVersions: "Макс. автосохранённых версий",
  maxAutosaveVersionsDesc: "Максимальное количество автосохранённых версий на файл. 0 — без ограничений.",
  allowedExtensions: "Разрешённые расширения файлов",
  allowedExtensionsDesc: "Расширения через пробел или запятую. .md всегда включён. Пример: json css js html",
  settings: "Настройки",
  on: "Вкл",
  off: "Выкл",
  minutes: "мин",
  useGlobal: "Как в глобальных",
  unlimited: "Без ограничений",
  resetToGlobal: "Сбросить к глобальным настройкам",
  langSystem: "Язык системы",

  searchSnapshotsCmd: "Поиск по всем версиям",
  searchSnapshotsCmdDesc: "Поиск по всем сохранённым версиям",
  searchInputPlaceholder: "Поиск по содержимому, имени файла, метке\u2026",
  searchNoResults: "Ничего не найдено",
  searchResultsCount: "Найдено: {n}",
  searchLoading: "Поиск\u2026",
  searchCurrentFile: "Текущий файл",
  searchOtherFiles: "Другие файлы",

  addToFavorites: "Добавить в избранное",
  removeFromFavorites: "Убрать из избранного",
};

const es: TranslationKeys = {
  cmdSaveNow: "Guardar versión ahora",
  cmdSaveNowDesc: "Guardar una versión del archivo actual",
  cmdRestore: "Restaurar versión\u2026",
  cmdRestoreDesc: "Restaurar una versión guardada",
  cmdOpenSidebar: "Abrir panel de historial",
  cmdRestoreLastBackup: "Restaurar última versión no guardada",
  cmdRestoreLastBackupDesc: "Restaurar la última copia de seguridad previa a la restauración para el archivo actual",
  noFileOpenSave: "Abre un archivo para guardar una versión.",
  noFileOpenRestore: "Abre un archivo para restaurar una versión.",

  viewTitle: "Historial del archivo",
  noActiveFile: "Ningún archivo activo.",
  fileLabel: "Archivo: {name}",
  saveVersionNow: "Guardar versión ahora",
  versionSaved: "Versión guardada.",
  noSavedVersions: "Aún no hay versiones guardadas.",

  groupNone: "Sin agrupar",
  groupDay: "Por día",
  groupWeek: "Por semana",
  groupMonth: "Por mes",
  groupYear: "Por año",

  diffTwoVersions: "Comparar dos versiones",
  cancelDiff: "Cancelar comparación",
  showDiff: "Mostrar diferencias",
  clear: "Limpiar",
  selectForDiff: "Seleccionar para comparar",
  deselect: "Deseleccionar",
  replaceSelection: "Reemplazar selección",
  diffNewer: "1 (más reciente)",
  diffOlder: "2 (más antigua)",
  diffWithCurrent: "Comparar con actual",
  currentFile: "Archivo actual",

  restore: "Restaurar",
  preview: "Vista previa",
  moreActions: "Más acciones",
  delete: "Eliminar",
  deleteConfirm: "¿Eliminar?",
  yes: "Sí",
  no: "No",
  versionDeleted: "Versión eliminada.",
  failedDeleteVersion: "Error al eliminar la versión.",

  bulkDeleteSelected: "Eliminar seleccionadas",
  bulkDeleteConfirm: "¿Eliminar las versiones seleccionadas?",
  bulkDeleteSuccess: "{n} versión(es) eliminada(s).",
  bulkDeleteFailed: "Error al eliminar algunas versiones.",
  selectAll: "Seleccionar todo",
  deselectAll: "Deseleccionar todo",
  failedLoadSnapshot: "Error al cargar la instantánea.",
  failedLoadSnapshotContent: "Error al cargar el contenido de la instantánea.",
  versionRestored: "Versión restaurada. El estado actual se ha respaldado abajo.",
  renameVersion: "Renombrar versión",
  labelUpdated: "Etiqueta actualizada.",
  failedUpdateLabel: "Error al actualizar la etiqueta.",
  save: "Guardar",
  cancel: "Cancelar",

  restoreThisVersion: "Restaurar esta versión",
  viewRaw: "Ver fuente",
  viewRendered: "Ver vista previa",
  close: "Cerrar",

  lastUnsavedVersion: "Última versión no guardada",
  autoSavedOnRestore: "Guardado automático al restaurar: {date} {time}",
  restoreBackup: "Restaurar copia de seguridad",
  backupRestored: "Copia de seguridad restaurada.",
  failedLoadBackup: "Error al cargar la copia de seguridad.",
  backupDeleted: "Copia de seguridad eliminada.",
  failedDeleteBackup: "Error al eliminar la copia de seguridad.",
  deleteBackup: "¿Eliminar copia de seguridad?",

  restoreVersion: "Restaurar versión",
  loadingVersions: "Cargando versiones\u2026",
  noSavedVersionsYet: "Aún no hay versiones guardadas.",
  unnamed: "(sin nombre)",
  versionRestoredDot: "Versión restaurada.",
  failedLoadSnapshotDot: "Error al cargar la instantánea seleccionada.",

  exportVersion: "Exportar versión",
  exportAllVersions: "Exportar todas las versiones",
  exportSuccess: "Versión exportada.",
  exportAllSuccess: "Todas las versiones exportadas a {path}.",
  exportNoVersions: "No hay versiones para exportar.",
  importVersions: "Importar versiones\u2026",
  importSuccess: "Versiones importadas.",
  importNoFiles: "Ningún archivo seleccionado.",

  exportFolder: "Carpeta de exportación",
  exportFolderDesc: "Carpeta en el vault donde se exportan las versiones cuando el selector de carpetas del navegador no está disponible.",
  exportFolderRenamed: "Carpeta de exportación renombrada correctamente.",
  exportFolderRenameFailed: "Error al renombrar la carpeta de exportación.",

  diff: "Diferencias",
  noDifferences: "Sin diferencias",
  added: "+{n} añadido",
  removed: "-{n} eliminado",
  changed: "~{n} cambiado",
  unchangedLinesShow: "\u25BE  {n} líneas sin cambios (clic para mostrar)  \u25BE",
  unchangedLinesHide: "\u25B4  {n} líneas sin cambios (clic para ocultar)  \u25B4",

  settingsTitle: "Configuración de Save History",
  language: "Idioma",
  languageDesc: "Idioma de la interfaz del plugin.",
  groupVersionsBy: "Agrupar versiones por",
  groupVersionsDesc: "Agrupar versiones guardadas en el panel lateral por período de tiempo.",
  snapshotFolder: "Carpeta de instantáneas",
  snapshotFolderDesc: "Carpeta en la raíz del vault donde se almacenan las versiones. Comienza con \".\" para ocultarla del explorador de Obsidian.",
  snapshotFolderRenamed: "Carpeta renombrada correctamente.",
  snapshotFolderRenameFailed: "Error al renombrar la carpeta.",

  versionPreview: "Vista previa de versión",
  noPreviewLoaded: "No hay vista previa cargada.",
  noChangesDetected: "Versión no guardada — no se detectaron cambios.",

  autosaveInterval: "Intervalo de guardado automático (min)",
  autosaveIntervalDesc: "Guardar automáticamente una versión cada N minutos. 0 para desactivar.",
  autosaveOnTabClose: "Guardado automático al cerrar pestaña",
  autosaveOnTabCloseDesc: "Guardar una versión al cerrar la pestaña del archivo.",
  autosaveVersionSaved: "Versión guardada automáticamente.",
  maxAutosaveVersions: "Máx. versiones automáticas",
  maxAutosaveVersionsDesc: "Número máximo de versiones automáticas por archivo. 0 = sin límite.",
  allowedExtensions: "Extensiones de archivo permitidas",
  allowedExtensionsDesc: "Extensiones separadas por espacio o coma. .md siempre está incluido. Ejemplo: json css js html",
  settings: "Configuración",
  on: "Activado",
  off: "Desactivado",
  minutes: "min",
  useGlobal: "Usar global",
  unlimited: "Sin límite",
  resetToGlobal: "Restablecer a configuración global",
  langSystem: "Idioma del sistema",

  searchSnapshotsCmd: "Buscar en todas las versiones",
  searchSnapshotsCmdDesc: "Buscar en todas las versiones guardadas",
  searchInputPlaceholder: "Buscar en contenido, nombre de archivo, etiqueta\u2026",
  searchNoResults: "Sin resultados",
  searchResultsCount: "{n} resultado(s)",
  searchLoading: "Buscando\u2026",
  searchCurrentFile: "Archivo actual",
  searchOtherFiles: "Otros archivos",

  addToFavorites: "Añadir a favoritos",
  removeFromFavorites: "Quitar de favoritos",
};

const translations: Record<"en" | "ru" | "es", TranslationKeys> = { en, ru, es };

let currentLanguage: Language = "system";

function detectSystemLanguage(): "en" | "ru" | "es" {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("es")) return "es";
  return "en";
}

function getEffectiveLanguage(): "en" | "ru" | "es" {
  if (currentLanguage === "system") return detectSystemLanguage();
  return currentLanguage;
}

export function setLanguage(lang: Language) {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function getLocale(): string | undefined {
  if (currentLanguage === "system") return undefined;
  const localeMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    es: "es-ES",
  };
  return localeMap[currentLanguage] || "en-US";
}

export function translate(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
  const lang = getEffectiveLanguage();
  let str = translations[lang][key] || translations.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
}
