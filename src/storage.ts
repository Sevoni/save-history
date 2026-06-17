import { SaveHistoryPlugin } from "./main";

export type SnapshotRecord = {
  path: string; // vault-relative
  timestamp: string; // ISO
  content: string;
  reason: string;
};

const LEGACY_SNAPSHOT_ROOT = ".versions(SH)";

function getSnapshotRoot(plugin: SaveHistoryPlugin): string {
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
  reason: string
) {
  await ensureSnapshotDir(plugin, vaultRelativePath);

  const record: SnapshotRecord = { path: vaultRelativePath, timestamp, content, reason };
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

  let listResult;
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
        const record = JSON.parse(json) as SnapshotRecord;
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
    return JSON.parse(json) as SnapshotRecord;
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
      return true;
    } catch {
      return false;
    }
  }
  return false;
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
      const record = JSON.parse(json) as SnapshotRecord;
      record.reason = newLabel;
      await adapter.write(filePath, JSON.stringify(record, null, 2));
      return true;
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

  // 1. Delete any existing pre-restore backup for this file
  if (await adapter.exists(dirPath)) {
    try {
      const listResult = await adapter.list(dirPath);
      for (const p of listResult.files || []) {
        const fullPath = p.replace(/\\/g, "/");
        const fullVaultPath = fullPath.startsWith(dirPath) ? fullPath : `${dirPath}/${fullPath}`;
        if (fullVaultPath.endsWith(".json")) {
          try {
            const json = await adapter.read(fullVaultPath);
            const record = JSON.parse(json) as SnapshotRecord;
            if (record.reason === "pre-restore") {
              await adapter.remove(fullVaultPath);
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

  // 2. Save the new pre-restore backup
  const timestamp = new Date().toISOString();
  await saveSnapshotContent(plugin, vaultRelativePath, timestamp, content, "pre-restore");
}

export async function renameSnapshotFolder(adapter: any, oldName: string, newName: string): Promise<boolean> {
  if (oldName === newName) return true;
  if (!(await adapter.exists(oldName))) return true;

  try {
    await adapter.rename(oldName, newName);
    return true;
  } catch {
    return false;
  }
}
