export type FileKind = 'photo' | 'video' | 'file';

export interface ScannedItem {
  id: string;
  name: string;
  handle?: FileSystemFileHandle;
  file: File;
  kind: FileKind;
  ext: string;
  size: number;
  lastModified: number;
  thumbUrl?: string;
  spriteCanvas?: HTMLCanvasElement;
  category?: string;
  categoryLabel?: string;
  confidence?: number;
  isDuplicate?: boolean;
  duplicateOf?: string;
  destPath?: string[];
  destFileName?: string;
  cardKey?: string;
  slotIndex?: number;
}

export interface CategoryDef {
  key: string;
  label: string;
  videoLabel?: string;
  color: string;
  ext?: string[];
  prompts?: string[];
}

export interface CardState {
  key: string;
  section: 'photos' | 'videos' | 'files' | 'dupes';
  catKey: string;
  label: string;
  color: string;
  dest: string[];
  items: ScannedItem[];
  landed: string[]; // item IDs that have physically arrived and landed
  slots: (string | null)[]; // ScannedItem ids currently visible in preview slots
  flash?: number;
}

export interface UndoMoveRecord {
  from: string;
  to: string[];
  error?: string;
}

export interface UndoLog {
  createdAt: string;
  moves: UndoMoveRecord[];
  fileName?: string;
}

export type AppState =
  | 'idle'
  | 'scanning'
  | 'sorting'
  | 'review'
  | 'moving'
  | 'done'
  | 'undoing';

export interface AIModelStatus {
  status: 'idle' | 'loading' | 'ready' | 'error';
  pct: number;
  device: string;
  error?: string;
}

