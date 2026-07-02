import { DataAdapter } from "obsidian";
import { SaveHistoryPlugin } from "./main";

export type SnapshotRecord = {
  timestamp: string; // ISO
  content: string;
  name: string;
  favorite?: boolean;
};

export function normalizeRecord(raw: Record<string, unknown>): SnapshotRecord {
  return {
    timestamp: String(raw.timestamp ?? ""),
    content: String(raw.content ?? ""),
    name: String(raw.name ?? raw.reason ?? ""),
    favorite: Boolean(raw.favorite),
  };
}

const LEGACY_SNAPSHOT_ROOT = ".versions(SH)";

export function getSnapshotRoot(plugin: SaveHistoryPlugin): string {
  return plugin.settings.snapshotFolder || LEGACY_SNAPSHOT_ROOT;
}

export function getSnapshotDirPath(plugin: SaveHistoryPlugin, vaultRelativePath: string): string {
  const normalized = vaultRelativePath.replace(/^\/+/, "");
  return `${getSnapshotRoot(plugin)}/${normalized}`;
}

export function getSnapshotFilePath(plugin: SaveHistoryPlugin, vaultRelativePath: string, timestamp: string): string {
  const safeTimestamp = timestamp.replace(/:/g, "-");
  return `${getSnapshotDirPath(plugin, vaultRelativePath)}/${safeTimestamp}.json`;
}

export async function ensureSnapshotDir(plugin: SaveHistoryPlugin, vaultRelativePath: string) {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;

  const parts = dirPath.split("/");
  let currentPath = "";
  for (const part of parts) {
    if (!part) continue;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (!(await adapter.exists(currentPath))) {
      try {
        await adapter.mkdir(currentPath);
      } catch {
        // Safe fallback in case multiple calls try to create it simultaneously
      }
    }
  }
}

export async function saveSnapshotContent(
  plugin: SaveHistoryPlugin,
  vaultRelativePath: string,
  timestamp: string,
  content: string,
  name: string
) {
  await ensureSnapshotDir(plugin, vaultRelativePath);

  const record: SnapshotRecord = { timestamp, content, name };
  const filePath = getSnapshotFilePath(plugin, vaultRelativePath, timestamp);
  const adapter = plugin.app.vault.adapter;

  await adapter.write(filePath, JSON.stringify(record, null, 2));
}

export async function listSnapshotsForFile(
  plugin: SaveHistoryPlugin,
  vaultRelativePath: string
): Promise<(SnapshotRecord & { filePath: string })[]> {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;

  if (!(await adapter.exists(dirPath))) {
    return [];
  }

  let listResult: { files: string[]; folders: string[] } | undefined;
  try {
    listResult = await adapter.list(dirPath);
  } catch {
    return [];
  }

  const jsonFiles = (listResult.files || [])
    .map((p: string) => p.replace(/\\/g, "/"))
    .filter((p: string) => p.endsWith(".json"))
    .sort();

  const snapshots: (SnapshotRecord & { filePath: string })[] = [];
  for (const p of jsonFiles) {
    const fullVaultPath = p.startsWith(dirPath) ? p : `${dirPath}/${p}`;
    try {
      const json = await adapter.read(fullVaultPath);
      if (json) {
        const record = normalizeRecord(JSON.parse(json) as Record<string, unknown>);
        snapshots.push({
          ...record,
          filePath: fullVaultPath
        });
      }
    } catch {
      // ignore invalid snapshot
    }
  }

  // newest first
  snapshots.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  return snapshots;
}

export async function readSnapshotContent(
  plugin: SaveHistoryPlugin,
  filePath: string
): Promise<SnapshotRecord | null> {
  const adapter = plugin.app.vault.adapter;

  if (!(await adapter.exists(filePath))) {
    return null;
  }

  try {
    const json = await adapter.read(filePath);
    return normalizeRecord(JSON.parse(json) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function deleteSnapshotFile(
  plugin: SaveHistoryPlugin,
  filePath: string
): Promise<boolean> {
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

export async function deleteOldestAutosaves(
  plugin: SaveHistoryPlugin,
  vaultRelativePath: string,
  keepCount: number
): Promise<void> {
  const snapshots = await listSnapshotsForFile(plugin, vaultRelativePath);
  const autosaves = snapshots.filter(s => s.name === "autosave");

  if (autosaves.length <= keepCount) return;

  const toDelete = autosaves.slice(keepCount);
  for (const s of toDelete) {
    await deleteSnapshotFile(plugin, s.filePath);
  }
}

async function removeEmptySnapshotDirs(plugin: SaveHistoryPlugin, filePath: string) {
  const adapter = plugin.app.vault.adapter;
  const root = getSnapshotRoot(plugin);

  // Walk upward from the deleted file's folder, removing empty dirs,
  // but never delete the configured snapshot root itself.
  const parts = filePath.replace(/\\/g, "/").split("/");
  parts.pop();
  let dir = parts.join("/");

  while (dir && dir !== root && dir.startsWith(root + "/")) {
    if (!(await adapter.exists(dir))) break;

    let listResult: { files: string[]; folders: string[] } | undefined;
    try {
      listResult = await adapter.list(dir);
    } catch {
      break;
    }

    const remainingFiles = (listResult.files || []).filter((p: string) => {
      const name = p.replace(/\\/g, "/").split("/").pop() || "";
      return !name.startsWith(".");
    });
    const remainingFolders = (listResult.folders || []).filter((p: string) => {
      const name = p.replace(/\\/g, "/").split("/").pop() || "";
      return !name.startsWith(".");
    });

    if (remainingFiles.length > 0 || remainingFolders.length > 0) break;

    try {
      await adapter.rmdir(dir, false);
    } catch {
      break;
    }

    dir = dir.split("/").slice(0, -1).join("/");
  }
}

export async function updateSnapshotLabel(
  plugin: SaveHistoryPlugin,
  filePath: string,
  newLabel: string
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;

  if (await adapter.exists(filePath)) {
    try {
      const json = await adapter.read(filePath);
      const record = normalizeRecord(JSON.parse(json) as Record<string, unknown>);
      record.name = newLabel;
      await adapter.write(filePath, JSON.stringify(record, null, 2));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function toggleSnapshotFavorite(
  plugin: SaveHistoryPlugin,
  filePath: string
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;
  if (await adapter.exists(filePath)) {
    try {
      const json = await adapter.read(filePath);
      const record = normalizeRecord(JSON.parse(json) as Record<string, unknown>);
      record.favorite = !record.favorite;
      await adapter.write(filePath, JSON.stringify(record, null, 2));
      return record.favorite;
    } catch {
      return false;
    }
  }
  return false;
}

export async function savePreRestoreBackup(
  plugin: SaveHistoryPlugin,
  vaultRelativePath: string,
  content: string
) {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;

  // If a pre-restore backup already exists, don't overwrite it —
  // preserve the original unsaved content until the user explicitly restores it.
  if (await adapter.exists(dirPath)) {
    try {
      const listResult = await adapter.list(dirPath);
      for (const p of listResult.files || []) {
        const fullPath = p.replace(/\\/g, "/");
        const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
        if (fullVaultPath.endsWith(".json")) {
          try {
            const json = await adapter.read(fullVaultPath);
            const record = normalizeRecord(JSON.parse(json) as Record<string, unknown>);
            if (record.name === "pre-restore") {
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const timestamp = new Date().toISOString();
  await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, "pre-restore");
}

async function resolvePath(adapter: DataAdapter, path: string): Promise<string | null> {
  const parts = path.replace(/\\/g, "/").split("/").filter(p => p);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await adapter.exists(current))) {
      return null;
    }
  }
  return current || null;
}

export async function renameSnapshotFolder(adapter: DataAdapter, oldName: string, newName: string): Promise<boolean> {
  if (oldName === newName) return true;

  const resolvedOld = await resolvePath(adapter, oldName);
  if (!resolvedOld) return true;

  const parentDir = newName.substring(0, newName.lastIndexOf("/"));
  if (parentDir) {
    const parts = parentDir.replace(/\\/g, "/").split("/").filter(p => p);
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!(await adapter.exists(currentPath))) {
        try {
          await adapter.mkdir(currentPath);
        } catch {
          // ignore
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
        // ignore — best effort cleanup
      }
    }

    // Clean up empty parent dirs left behind after the move
    const oldParent = resolvedOld.substring(0, resolvedOld.lastIndexOf("/"));
    if (oldParent) {
      let dir = oldParent;
      while (dir) {
        if (!(await adapter.exists(dir))) break;
        let listResult: { files: string[]; folders: string[] } | undefined;
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
          await adapter.rmdir(dir, false);
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

export async function deleteSnapshotDirForFile(
  plugin: SaveHistoryPlugin,
  vaultRelativePath: string
): Promise<void> {
  const dirPath = getSnapshotDirPath(plugin, vaultRelativePath);
  const adapter = plugin.app.vault.adapter;

  if (!(await adapter.exists(dirPath))) return;

  let listResult: { files: string[]; folders: string[] } | undefined;
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
      // ignore
    }
  }

  for (const p of listResult.folders || []) {
    const fullPath = p.replace(/\\/g, "/");
    const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
    try {
      await adapter.rmdir(fullVaultPath, false);
    } catch {
      // ignore
    }
  }

  try {
    await adapter.rmdir(dirPath, false);
  } catch {
    // ignore
  }

  const parentDir = dirPath.substring(0, dirPath.lastIndexOf("/"));
  await removeEmptyParentDirs(plugin, parentDir);
}

export function getExportFolderPath(plugin: SaveHistoryPlugin): string {
  return plugin.settings.exportFolder || "Exported versions";
}

export async function ensureExportDir(plugin: SaveHistoryPlugin): Promise<void> {
  const dirPath = getExportFolderPath(plugin);
  const adapter = plugin.app.vault.adapter;

  const parts = dirPath.split("/");
  let currentPath = "";
  for (const part of parts) {
    if (!part) continue;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    if (!(await adapter.exists(currentPath))) {
      try {
        await adapter.mkdir(currentPath);
      } catch {
        // concurrent creation
      }
    }
  }
}

export async function exportSnapshotToVault(
  plugin: SaveHistoryPlugin,
  fileName: string,
  content: string
): Promise<void> {
  const dirPath = getExportFolderPath(plugin);
  const filePath = `${dirPath}/${fileName}`;
  const adapter = plugin.app.vault.adapter;

  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash > 0) {
    const parentDir = filePath.substring(0, lastSlash);
    const parts = parentDir.split("/");
    let currentPath = "";
    for (const part of parts) {
      if (!part) continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!(await adapter.exists(currentPath))) {
        try {
          await adapter.mkdir(currentPath);
        } catch {
          // concurrent creation
        }
      }
    }
  }

  await adapter.write(filePath, content);
}

export async function renameExportFolder(adapter: DataAdapter, oldName: string, newName: string): Promise<boolean> {
  if (oldName === newName) return true;

  const resolvedOld = await resolvePath(adapter, oldName);
  if (!resolvedOld) return true;

  const parentDir = newName.substring(0, newName.lastIndexOf("/"));
  if (parentDir) {
    const parts = parentDir.replace(/\\/g, "/").split("/").filter(p => p);
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!(await adapter.exists(currentPath))) {
        try {
          await adapter.mkdir(currentPath);
        } catch {
          // ignore
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
        // ignore
      }
    }

    const oldParent = resolvedOld.substring(0, resolvedOld.lastIndexOf("/"));
    if (oldParent) {
      let dir = oldParent;
      while (dir) {
        if (!(await adapter.exists(dir))) break;
        let listResult: { files: string[]; folders: string[] } | undefined;
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
          await adapter.rmdir(dir, false);
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

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createSearchRegex(query: string): RegExp {
  if (!query) return /(?!)/gi;

  if (query.includes("*") || query.includes("?") || query.includes("\\")) {
    let pattern = "";
    for (let i = 0; i < query.length; i++) {
      const c = query[i];
      if (c === "\\" && i + 1 < query.length) {
        const next = query[i + 1];
        if (next === "?") { pattern += "\\?"; i++; }
        else if (next === "*") { pattern += "\\*"; i++; }
        else if (next === "\\") { pattern += "\\\\"; i++; }
        else { pattern += "\\\\"; }
      } else if (c === "?") {
        pattern += ".";
      } else if (c === "*") {
        pattern += ".*";
      } else {
        pattern += /[.+^${}()|[\]\\]/.test(c) ? "\\" + c : c;
      }
    }
    return new RegExp(pattern, "gi");
  }

  try {
    return new RegExp(query, "gi");
  } catch {
    return new RegExp(escapeRegex(query), "gi");
  }
}

function getMatchRanges(content: string, query: string): { start: number; end: number }[] {
  if (!query || !content) return [];

  const regex = createSearchRegex(query);

  const ranges: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    if (match.index === regex.lastIndex) regex.lastIndex++;
  }

  return ranges;
}

function generateSnippet(content: string, query: string): string {
  const ranges = getMatchRanges(content, query);
  if (ranges.length === 0) return content.slice(0, 200);

  const first = ranges[0];
  const snippetLen = 200;
  const halfSnippet = Math.floor(snippetLen / 2);
  let start = Math.max(0, first.start - halfSnippet);
  let end = Math.min(content.length, first.end + halfSnippet);

  let snippet = content.slice(start, end);
  if (start > 0) snippet = "\u2026" + snippet;
  if (end < content.length) snippet = snippet + "\u2026";

  return snippet;
}

export function derivePathFromSnapshotFile(plugin: SaveHistoryPlugin, filePath: string): string {
  const root = getSnapshotRoot(plugin);
  const normalized = filePath.replace(/\\/g, "/");
  const prefix = root + "/";
  if (!normalized.startsWith(prefix)) return "";
  const afterRoot = normalized.slice(prefix.length);
  const lastSlash = afterRoot.lastIndexOf("/");
  if (lastSlash < 0) return "";
  return afterRoot.slice(0, lastSlash);
}

export type SearchMatch = SnapshotRecord & {
  filePath: string;
  path: string;
  snippet: string;
  isCurrentFile: boolean;
};

export async function searchSnapshots(
  plugin: SaveHistoryPlugin,
  query: string
): Promise<SearchMatch[]> {
  if (!query.trim()) return [];

  const root = getSnapshotRoot(plugin);
  const adapter = plugin.app.vault.adapter;
  const results: SearchMatch[] = [];
  const queryTrimmed = query.trim();
  const currentFilePath = plugin.getActiveFile()?.path ?? "";

  await walkJsonFiles(adapter, root, async (filePath) => {
    try {
      const json = await adapter.read(filePath);
      const record = normalizeRecord(JSON.parse(json) as Record<string, unknown>);
      const derivedPath = derivePathFromSnapshotFile(plugin, filePath);

      const ranges = getMatchRanges(record.content, queryTrimmed);
      if (ranges.length > 0) {
        const snippet = generateSnippet(record.content, queryTrimmed);
        results.push({
          ...record,
          filePath,
          path: derivedPath,
          snippet,
          isCurrentFile: derivedPath === currentFilePath,
        });
        return;
      }

      if (getMatchRanges(derivedPath, queryTrimmed).length > 0) {
        results.push({
          ...record,
          filePath,
          path: derivedPath,
          snippet: derivedPath,
          isCurrentFile: derivedPath === currentFilePath,
        });
        return;
      }

      const localTimeStr = new Date(record.timestamp).toLocaleString();
      if (getMatchRanges(localTimeStr, queryTrimmed).length > 0) {
        results.push({
          ...record,
          filePath,
          path: derivedPath,
          snippet: localTimeStr,
          isCurrentFile: derivedPath === currentFilePath,
        });
        return;
      }
    } catch {
      // skip invalid files
    }
  });

  results.sort((a, b) => {
    if (a.isCurrentFile !== b.isCurrentFile) {
      return a.isCurrentFile ? -1 : 1;
    }
    if (!!a.favorite !== !!b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return a.timestamp > b.timestamp ? -1 : 1;
  });

  return results;
}

export async function removeEmptyParentDirs(plugin: SaveHistoryPlugin, dirPath: string) {
  const snapshotRoot = getSnapshotRoot(plugin);
  let currentDir = dirPath.replace(/\\/g, "/");

  while (currentDir && currentDir !== snapshotRoot && currentDir.startsWith(snapshotRoot + "/")) {
    if (!(await plugin.app.vault.adapter.exists(currentDir))) break;

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
      await plugin.app.vault.adapter.rmdir(currentDir, false);
    } catch {
      break;
    }

    currentDir = currentDir.split("/").slice(0, -1).join("/");
  }
}

async function walkJsonFiles(
  adapter: DataAdapter,
  dirPath: string,
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  if (!(await adapter.exists(dirPath))) return;

  const jsonFiles: string[] = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let listResult: { files: string[]; folders: string[] };
    try {
      listResult = await adapter.list(current);
    } catch {
      continue;
    }

    for (const folder of listResult.folders || []) {
      const full = folder.replace(/\\/g, "/");
      stack.push(full.startsWith(current) ? full : `${current}/${full}`);
    }

    for (const file of listResult.files || []) {
      const full = file.replace(/\\/g, "/");
      const fullPath = full.startsWith(current) ? full : `${current}/${full}`;
      if (fullPath.endsWith(".json")) {
        jsonFiles.push(fullPath);
      }
    }
  }

  await Promise.all(jsonFiles.map(callback));
}

export async function writeTempVersionFile(
  plugin: SaveHistoryPlugin,
  sourceFilePath: string,
  timestamp: string,
  content: string
): Promise<string> {
  const root = getSnapshotRoot(plugin);
  const tmpDir = `${root}/.tmp`;
  const adapter = plugin.app.vault.adapter;

  if (!(await adapter.exists(tmpDir))) {
    await adapter.mkdir(tmpDir);
  }

  const sourceName = sourceFilePath.split("/").pop() || "unknown";
  const baseName = sourceName.replace(/\.[^.]+$/, "");
  const ext = sourceName.includes(".") ? sourceName.split(".").pop()! : "md";
  const safeTs = timestamp.replace(/:/g, "-");
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `${baseName}_${safeTs}_${random}.${ext}`;
  const filePath = `${tmpDir}/${fileName}`;

  await adapter.write(filePath, content);
  return filePath;
}

export async function deleteTempVersionFile(
  plugin: SaveHistoryPlugin,
  tempFilePath: string
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  try {
    if (await adapter.exists(tempFilePath)) {
      await adapter.remove(tempFilePath);
    }
  } catch {
    // ignore
  }
}


