import { ScannedItem, UndoLog } from '../types';
import {
  FILE_CATEGORIES,
  PHOTO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  TEMP_EXTENSIONS,
  VOICE_REGEX,
} from '../constants/categories';
import JSZip from 'jszip';

export const SORTED_FOLDER_NAME = 'Sorted';

export function getFileKind(ext: string): 'photo' | 'video' | 'file' {
  if (PHOTO_EXTENSIONS.includes(ext)) return 'photo';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'file';
}

export function matchRuleCategory(fileName: string, ext: string) {
  // 1. Check Voice notes regex / extension
  if (VOICE_REGEX.test(fileName) || ext === 'opus') {
    const voiceCat = FILE_CATEGORIES.find((c) => c.key === 'voice');
    if (voiceCat) return voiceCat;
  }

  // 2. Extension match
  const found = FILE_CATEGORIES.find((c) => c.ext?.includes(ext));
  if (found) return found;

  // 3. Fallback to other files
  return FILE_CATEGORIES[FILE_CATEGORIES.length - 1];
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window && window.isSecureContext;
}

/**
 * Native Chromium Directory Picker & File Scanner
 * Can optionally start in 'downloads', 'desktop', 'documents', 'pictures', or anywhere.
 */
export async function pickDirectory(startIn?: string): Promise<{
  dirHandle: FileSystemDirectoryHandle;
  dirName: string;
  items: ScannedItem[];
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('FileSystemAccessUnsupported');
  }

  const pickerOptions: any = {
    mode: 'readwrite',
  };

  if (startIn && ['downloads', 'desktop', 'documents', 'pictures', 'music', 'videos'].includes(startIn)) {
    pickerOptions.startIn = startIn;
    pickerOptions.id = `sorter-start-${startIn}`;
  }

  const dirHandle = await (window as any).showDirectoryPicker(pickerOptions);

  const items: ScannedItem[] = [];
  let index = 0;

  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (handle.kind !== 'file') continue;
    if (name.startsWith('.') || name === 'desktop.ini') continue;

    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    if (TEMP_EXTENSIONS.includes(ext)) continue;

    const file = await handle.getFile();
    const kind = getFileKind(ext);

    items.push({
      id: `file_${index++}`,
      name,
      handle,
      file,
      kind,
      ext,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  return { dirHandle, dirName: dirHandle.name, items };
}

/**
 * Universal FileList Parser (from HTML <input type="file" webkitdirectory /> or Drag & Drop)
 * Works across ALL browsers (Chrome, Edge, Firefox, Safari) and over HTTP/LAN IPs!
 */
export function parseFileList(fileList: FileList | File[]): {
  dirName: string;
  items: ScannedItem[];
} {
  const items: ScannedItem[] = [];
  let detectedDirName = 'Selected Folder';
  let index = 0;

  const filesArray = Array.from(fileList);

  for (const file of filesArray) {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const parts = relativePath.split('/');

    if (parts.length > 1 && detectedDirName === 'Selected Folder') {
      detectedDirName = parts[0];
    }

    // Ignore subdirectories if user picked root, or take only direct children / flat files
    const fileName = file.name;
    if (fileName.startsWith('.') || fileName === 'desktop.ini') continue;

    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (TEMP_EXTENSIONS.includes(ext)) continue;

    const kind = getFileKind(ext);

    items.push({
      id: `file_${index++}`,
      name: fileName,
      file,
      kind,
      ext,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  return { dirName: detectedDirName, items };
}

/**
 * Ensures destination subdirectories exist.
 */
export async function ensureNestedDir(
  root: FileSystemDirectoryHandle,
  pathSegments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const seg of pathSegments) {
    current = await current.getDirectoryHandle(seg, { create: true });
  }
  return current;
}

/**
 * Finds an available file name by incrementing (1), (2), etc.
 */
export async function getUniqueFileName(
  dir: FileSystemDirectoryHandle,
  fileName: string
): Promise<string> {
  let exists = true;
  try {
    await dir.getFileHandle(fileName);
  } catch {
    exists = false;
  }

  if (!exists) return fileName;

  const dotIdx = fileName.lastIndexOf('.');
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : '';

  for (let i = 1; i < 10000; i++) {
    const candidate = `${base} (${i})${ext}`;
    try {
      await dir.getFileHandle(candidate);
    } catch {
      return candidate;
    }
  }
  throw new Error(`Could not find a unique file name for ${fileName}`);
}

/**
 * Moves a file handle into a target directory.
 */
export async function moveFile(
  parentDir: FileSystemDirectoryHandle,
  fileHandle: FileSystemFileHandle,
  sourceName: string,
  targetDir: FileSystemDirectoryHandle
): Promise<string> {
  const safeName = await getUniqueFileName(targetDir, sourceName);

  // Modern Chromium 111+ move API
  if (typeof (fileHandle as any).move === 'function') {
    try {
      await (fileHandle as any).move(targetDir, safeName);
      return safeName;
    } catch (e: any) {
      if (e?.name !== 'NotSupportedError' && e?.name !== 'TypeError') throw e;
    }
  }

  // Fallback: Stream copy & delete original
  const file = await fileHandle.getFile();
  const newHandle = await targetDir.getFileHandle(safeName, { create: true });
  const writable = await (newHandle as any).createWritable();
  await file.stream().pipeTo(writable);
  await (parentDir as any).removeEntry(sourceName);
  return safeName;
}

/**
 * Executes in-place file moves on disk and writes an undo log.
 */
export async function executeSortMoves(
  rootDir: FileSystemDirectoryHandle,
  items: ScannedItem[],
  onProgress?: (done: number, total: number, item: ScannedItem) => void
): Promise<UndoLog> {
  const undoLog: UndoLog = {
    createdAt: new Date().toISOString(),
    moves: [],
  };

  const targetDirCache = new Map<string, FileSystemDirectoryHandle>();
  let count = 0;

  for (const item of items) {
    if (!item.destPath || !item.handle) continue;

    const pathKey = item.destPath.join('/');
    let targetDir = targetDirCache.get(pathKey);
    if (!targetDir) {
      targetDir = await ensureNestedDir(rootDir, [SORTED_FOLDER_NAME, ...item.destPath]);
      targetDirCache.set(pathKey, targetDir);
    }

    try {
      const movedName = await moveFile(rootDir, item.handle, item.name, targetDir);
      undoLog.moves.push({
        from: item.name,
        to: [SORTED_FOLDER_NAME, ...item.destPath, movedName],
      });
    } catch (err: any) {
      undoLog.moves.push({
        from: item.name,
        to: [],
        error: String(err?.message || err),
      });
    }

    count++;
    onProgress?.(count, items.length, item);
  }

  // Write undo log to Sorted/_undo-log-<date>.json
  try {
    const sortedDir = await rootDir.getDirectoryHandle(SORTED_FOLDER_NAME, { create: true });
    const logDate = undoLog.createdAt.replace(/[:.]/g, '-');
    const logFileHandle = await sortedDir.getFileHandle(`_undo-log-${logDate}.json`, { create: true });
    const writer = await (logFileHandle as any).createWritable();
    await writer.write(JSON.stringify(undoLog, null, 2));
    await writer.close();
  } catch (err) {
    console.error('Failed to write undo log:', err);
  }

  return undoLog;
}

/**
 * Exports organized files into a structured ZIP file for download.
 * Used when user uploads via standard file input or on browsers without direct disk write.
 */
export async function exportSortedZip(
  items: ScannedItem[],
  folderName: string = 'Sorted_Files',
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(folderName) || zip;

  for (const item of items) {
    const path = item.destPath ? item.destPath.join('/') : 'Other';
    const folder = root.folder(path);
    if (folder) {
      folder.file(item.name, item.file);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress?.(Math.round(metadata.percent));
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reverses all moves recorded in an undo log.
 */
export async function executeUndoMoves(
  rootDir: FileSystemDirectoryHandle,
  undoLog: UndoLog,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  let reverted = 0;
  const successfulMoves = undoLog.moves.filter((m) => m.to && m.to.length > 0);

  for (let i = 0; i < successfulMoves.length; i++) {
    const record = successfulMoves[i];
    try {
      const folderSegments = record.to.slice(0, -1);
      const currentFileName = record.to[record.to.length - 1];

      let folderHandle = rootDir;
      for (const seg of folderSegments) {
        folderHandle = await folderHandle.getDirectoryHandle(seg);
      }

      const fileHandle = await folderHandle.getFileHandle(currentFileName);
      await moveFile(folderHandle, fileHandle, currentFileName, rootDir);
      reverted++;
    } catch (e) {
      console.warn(`Failed to undo ${record.from}:`, e);
    }
    onProgress?.(i + 1, successfulMoves.length);
  }

  // Attempt to remove empty folders in Sorted/
  try {
    await cleanupEmptyDirs(rootDir, SORTED_FOLDER_NAME);
  } catch {}

  return reverted;
}

/**
 * Recursively deletes empty folders.
 */
async function cleanupEmptyDirs(parent: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  let target: FileSystemDirectoryHandle;
  try {
    target = await parent.getDirectoryHandle(name);
  } catch {
    return true;
  }

  let isEmpty = true;
  const subdirs: string[] = [];

  for await (const [childName, handle] of (target as any).entries()) {
    if (handle.kind === 'directory') {
      subdirs.push(childName);
    } else {
      if (childName.startsWith('_undo-log-') || childName === '.DS_Store') continue;
      isEmpty = false;
    }
  }

  for (const sub of subdirs) {
    const subClean = await cleanupEmptyDirs(target, sub);
    if (!subClean) isEmpty = false;
  }

  if (isEmpty) {
    try {
      await (parent as any).removeEntry(name, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Creates demo sample files for testing without touching user's real folders!
 */
export function generateDemoFiles(): ScannedItem[] {
  const demoList: { name: string; size: number; kind: 'photo' | 'video' | 'file' }[] = [
    { name: 'Selfie_Cafe_Sunday.jpg', size: 2450000, kind: 'photo' },
    { name: 'Selfie_Cafe_Sunday (Copy).jpg', size: 2450000, kind: 'photo' },
    { name: 'Paris_Eiffel_Tower_Sunset.jpg', size: 3890000, kind: 'photo' },
    { name: 'Delicious_Italian_Pizza.jpg', size: 1980000, kind: 'photo' },
    { name: 'Clean_Minimal_Bedroom.png', size: 4120000, kind: 'photo' },
    { name: 'Invoice_Amazon_Receipt_Oct2026.pdf', size: 125000, kind: 'file' },
    { name: 'Quarterly_Financial_Report.xlsx', size: 684000, kind: 'file' },
    { name: 'Product_Roadmap_2026.pptx', size: 5400000, kind: 'file' },
    { name: 'Website_Design_System.fig', size: 14200000, kind: 'file' },
    { name: 'CleanShot 2026-11-03 at 14.22.45.png', size: 850000, kind: 'photo' },
    { name: 'Screen Recording 2026-11-02 at 18.05.mov', size: 28400000, kind: 'video' },
    { name: 'Docker_Desktop_Installer.dmg', size: 590000000, kind: 'file' },
    { name: 'React_App_Source.zip', size: 3200000, kind: 'file' },
    { name: 'Inter-VariableFont_slnt_wght.ttf', size: 450000, kind: 'file' },
    { name: 'Funny_Cat_Programming_Meme.jpg', size: 760000, kind: 'photo' },
    { name: 'PTT-20261103-WA0012.opus', size: 310000, kind: 'file' },
    { name: 'server_api_routes.ts', size: 28000, kind: 'file' },
    { name: 'Harley_Davidson_Cruiser.jpg', size: 3200000, kind: 'photo' },
    { name: 'Workout_Gym_Progress.jpg', size: 2750000, kind: 'photo' },
  ];

  return demoList.map((item, idx) => {
    const ext = item.name.split('.').pop()!.toLowerCase();
    const dummyBlob = new Blob([new Uint8Array(Math.min(item.size, 1024))], { type: 'application/octet-stream' });
    const file = new File([dummyBlob], item.name, {
      type: item.kind === 'photo' ? 'image/jpeg' : 'application/octet-stream',
      lastModified: Date.now() - idx * 3600000,
    });

    return {
      id: `demo_${idx}`,
      name: item.name,
      file,
      kind: item.kind,
      ext,
      size: item.size,
      lastModified: file.lastModified,
    };
  });
}
