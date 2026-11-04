import { ScannedItem } from '../types';

/**
 * Computes a fast partial SHA-256 fingerprint for a file.
 * If file > 12 MB, samples first 4MB and last 4MB (8MB total).
 * This prevents memory spikes and browser tab crashing on large files.
 */
export async function getFileFingerprint(file: File): Promise<string> {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB
  let buffer: ArrayBuffer | Uint8Array;

  if (file.size > CHUNK_SIZE * 3) {
    const head = await file.slice(0, CHUNK_SIZE).arrayBuffer();
    const tail = await file.slice(file.size - CHUNK_SIZE).arrayBuffer();
    const combined = new Uint8Array(CHUNK_SIZE * 2);
    combined.set(new Uint8Array(head), 0);
    combined.set(new Uint8Array(tail), CHUNK_SIZE);
    buffer = combined;
  } else {
    buffer = await file.arrayBuffer();
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  // Convert first 12 bytes to 24 hex characters
  return Array.from(new Uint8Array(hashBuffer).slice(0, 12))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Detects duplicate files.
 * Stage 1: Group by exact file.size.
 * Stage 2: For items with same size, compute partial hash.
 * Returns Set of item IDs that are duplicates.
 */
export async function detectDuplicates(items: ScannedItem[]): Promise<Set<string>> {
  // Stage 1: Group by file.size
  const sizeMap = new Map<number, ScannedItem[]>();
  for (const item of items) {
    if (item.size === 0) continue;
    const list = sizeMap.get(item.size) || [];
    list.push(item);
    sizeMap.set(item.size, list);
  }

  const duplicateIds = new Set<string>();

  // Stage 2: Hash files that share the exact size
  for (const group of sizeMap.values()) {
    if (group.length < 2) continue;

    // Sort to keep cleaner or older file as primary
    group.sort((a, b) => a.name.length - b.name.length || a.lastModified - b.lastModified);

    const hashMap = new Map<string, string>(); // hash -> originalId
    for (const item of group) {
      try {
        const hash = await getFileFingerprint(item.file);
        if (hashMap.has(hash)) {
          duplicateIds.add(item.id);
          item.isDuplicate = true;
          item.duplicateOf = hashMap.get(hash);
        } else {
          hashMap.set(hash, item.id);
        }
      } catch (err) {
        console.warn(`Failed to hash ${item.name}:`, err);
      }
    }
  }

  return duplicateIds;
}

