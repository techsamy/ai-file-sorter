import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScannedItem,
  CardState,
  AppState,
  AIModelStatus,
  UndoLog,
} from './types';
import {
  PHOTO_CATEGORIES,
  OTHER_PHOTOS,
  SCREENSHOT_REGEX,
} from './constants/categories';
import {
  pickDirectory,
  matchRuleCategory,
  executeSortMoves,
  executeUndoMoves,
  generateDemoFiles,
  parseFileList,
  exportSortedZip,
  isFileSystemAccessSupported,
  SORTED_FOLDER_NAME,
} from './services/fsService';
import { detectDuplicates } from './services/duplicateDetector';
import {
  makeImageThumbnail,
  makeVideoThumbnail,
  makeFileSprite,
} from './services/thumbnailService';
import { CanvasVortex, VortexController } from './components/CanvasVortex';
import { StatsBar } from './components/StatsBar';
import { CategoryCard } from './components/CategoryCard';
import { FileDetailsModal } from './components/FileDetailsModal';
import {
  FolderOpen,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Cpu,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Play,
  Upload,
  Download,
  Info,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('idle');
  const [dirName, setDirName] = useState<string>('');
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [items, setItems] = useState<Map<string, ScannedItem>>(new Map());
  const [cards, setCards] = useState<Map<string, CardState>>(new Map());
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState<AIModelStatus>({
    status: 'idle',
    pct: 0,
    device: '',
  });

  const [moveProgress, setMoveProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [undoLog, setUndoLog] = useState<UndoLog | null>(null);
  const [notification, setNotification] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showSecurityExplainer, setShowSecurityExplainer] = useState<boolean>(false);

  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const vortexRef = useRef<VortexController | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingAiCallbacks = useRef<Map<string, (cat: string | null, score: number) => void>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const nativeFSSupported = isFileSystemAccessSupported();

  // Initialize AI Web Worker
  useEffect(() => {
    try {
      const worker = new Worker(new URL('./workers/ai.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'progress') {
          const pct = data.total ? Math.round((data.loaded / data.total) * 100) : 0;
          setAiStatus((prev) => ({ ...prev, status: 'loading', pct }));
        } else if (data.type === 'ready') {
          setAiStatus({ status: 'ready', pct: 100, device: data.device });
        } else if (data.type === 'error') {
          console.warn('AI Worker error:', data.error);
          setAiStatus({ status: 'error', pct: 0, device: '', error: data.error });
        } else if (data.type === 'result') {
          const cb = pendingAiCallbacks.current.get(data.id);
          if (cb) {
            pendingAiCallbacks.current.delete(data.id);
            cb(data.category, data.confidence || 0);
          }
        }
      };

      setAiStatus({ status: 'loading', pct: 0, device: '' });
      worker.postMessage({
        type: 'init',
        categories: PHOTO_CATEGORIES.map((c) => ({
          key: c.key,
          prompts: c.prompts || [],
        })),
      });

      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.warn('Web Worker failed to initialize:', err);
      setAiStatus({ status: 'error', pct: 0, device: '' });
    }
  }, []);

  // Dispatch AI Classification to Worker
  const classifyViaAI = useCallback((id: string, blob: Blob): Promise<{ category: string | null; score: number }> => {
    return new Promise((resolve) => {
      if (!workerRef.current || aiStatus.status === 'error') {
        return resolve({ category: null, score: 0 });
      }
      pendingAiCallbacks.current.set(id, (cat, score) => resolve({ category: cat, score }));
      workerRef.current.postMessage({ type: 'classify', id, blob });
    });
  }, [aiStatus.status]);

  // Handle assigning an item to a category card (Idempotent, strictly prevents duplicate counts)
  const assignToCard = useCallback((
    item: ScannedItem,
    section: 'photos' | 'videos' | 'files' | 'dupes',
    catKey: string,
    label: string,
    color: string,
    dest: string[]
  ) => {
    const cardKey = `${section}:${catKey}`;
    item.cardKey = cardKey;
    item.destPath = dest;

    setCards((prev) => {
      const next = new Map(prev);
      const existingCard = next.get(cardKey);

      if (!existingCard) {
        const initialSlots = Array(6).fill(null);
        initialSlots[0] = item.id;
        item.slotIndex = 0;

        next.set(cardKey, {
          key: cardKey,
          section,
          catKey,
          label,
          color,
          dest,
          items: [item],
          slots: initialSlots,
        });
        return next;
      }

      // Check if item is already in card to guarantee accurate file counts
      if (!existingCard.items.some((it) => it.id === item.id)) {
        const newItems = [...existingCard.items, item];
        const newSlots = [...existingCard.slots];
        const emptyIndex = newSlots.findIndex((s) => s === null);
        if (emptyIndex !== -1) {
          newSlots[emptyIndex] = item.id;
          item.slotIndex = emptyIndex;
        } else {
          // If all 6 preview slots are full, item still belongs to this card
          item.slotIndex = undefined;
        }

        next.set(cardKey, {
          ...existingCard,
          items: newItems,
          slots: newSlots,
        });
      }

      return next;
    });

    // Launch item sprite from vortex to card
    if (vortexRef.current) {
      vortexRef.current.launchSprite(item.id);
    }
  }, []);

  // Run the full sorting pipeline
  const runSortingPipeline = async (scannedFiles: ScannedItem[]) => {
    setAppState('sorting');
    setErrorMessage('');
    setNotification('Scanning and generating thumbnails...');

    const itemsMap = new Map<string, ScannedItem>();
    scannedFiles.forEach((item) => itemsMap.set(item.id, item));
    setItems(itemsMap);

    // 1. Detect duplicates
    const duplicateSet = await detectDuplicates(scannedFiles);

    // 2. Process thumbnails and assign sprites
    for (const item of scannedFiles) {
      if (item.kind === 'photo') {
        try {
          const res = await makeImageThumbnail(item.file);
          item.thumbUrl = res.thumbUrl;
          item.spriteCanvas = res.sprite;
          vortexRef.current?.addSprite(item.id, res.sprite, scannedFiles.length);
        } catch {
          const sprite = makeFileSprite(item.ext, '#ec4899');
          vortexRef.current?.addSprite(item.id, sprite, scannedFiles.length);
        }
      } else if (item.kind === 'video') {
        try {
          const res = await makeVideoThumbnail(item.file);
          item.thumbUrl = res.thumbUrl;
          item.spriteCanvas = res.sprite;
          vortexRef.current?.addSprite(item.id, res.sprite, scannedFiles.length);
        } catch {
          const sprite = makeFileSprite(item.ext, '#f43f5e');
          vortexRef.current?.addSprite(item.id, sprite, scannedFiles.length);
        }
      } else {
        const ruleCat = matchRuleCategory(item.name, item.ext);
        const sprite = makeFileSprite(item.ext, ruleCat.color);
        vortexRef.current?.addSprite(item.id, sprite, scannedFiles.length);
      }
    }

    setNotification('Categorizing with on-device Vision AI & Rules...');

    // 3. Classify and route each file
    for (const item of scannedFiles) {
      // Duplicates go to Duplicates folder
      if (duplicateSet.has(item.id)) {
        assignToCard(item, 'dupes', 'duplicates', 'Duplicates', '#f43f5e', ['Duplicates']);
        continue;
      }

      // Screenshots filename check
      if (SCREENSHOT_REGEX.test(item.name)) {
        if (item.kind === 'video') {
          assignToCard(item, 'videos', 'screen_recordings', 'Screen recordings', '#0ea5e9', ['Videos', 'Screen recordings']);
        } else {
          assignToCard(item, 'photos', 'screens', 'Screenshots', '#0ea5e9', ['Photos', 'Screenshots']);
        }
        continue;
      }

      // Photos & Videos: AI Classification
      if (item.kind === 'photo' || item.kind === 'video') {
        let matchedCatKey: string | null = null;
        let score = 0;

        if (item.thumbUrl) {
          try {
            const blob = await fetch(item.thumbUrl).then((r) => r.blob());
            const aiRes = await classifyViaAI(item.id, blob);
            matchedCatKey = aiRes.category;
            score = aiRes.score;
          } catch {}
        }

        const foundCat = PHOTO_CATEGORIES.find((c) => c.key === matchedCatKey) || OTHER_PHOTOS;
        item.category = foundCat.key;
        item.categoryLabel = item.kind === 'video' ? foundCat.videoLabel || foundCat.label : foundCat.label;
        item.confidence = score;

        const section = item.kind === 'video' ? 'videos' : 'photos';
        const sectionTitle = item.kind === 'video' ? 'Videos' : 'Photos';

        assignToCard(
          item,
          section,
          foundCat.key,
          item.categoryLabel,
          foundCat.color,
          [sectionTitle, item.categoryLabel]
        );
      } else {
        // Non-media rule based classification
        const ruleCat = matchRuleCategory(item.name, item.ext);
        item.category = ruleCat.key;
        item.categoryLabel = ruleCat.label;

        assignToCard(
          item,
          'files',
          ruleCat.key,
          ruleCat.label,
          ruleCat.color,
          [ruleCat.label]
        );
      }

      // Small delay for natural progressive flow
      await new Promise((r) => setTimeout(r, 20));
    }

    // Cleanly drain all particles from the central vortex into destination cards
    vortexRef.current?.drainAll();

    setAppState('review');
    setNotification('Sorting complete! Review the categories below and proceed.');
  };

  // Handler for Native Directory Picker (Chrome/Edge on localhost or HTTPS)
  const handlePickDirectory = async (startFolder?: string) => {
    setErrorMessage('');
    try {
      vortexRef.current?.clear();
      setCards(new Map());

      if (!nativeFSSupported) {
        fileInputRef.current?.click();
        return;
      }

      setAppState('scanning');
      setNotification('Opening system folder picker...');

      const res = await pickDirectory(startFolder);
      setDirHandle(res.dirHandle);
      setDirName(res.dirName);

      if (res.items.length === 0) {
        setAppState('idle');
        setNotification(`No loose files found in “${res.dirName}”. It's already tidy!`);
        return;
      }

      await runSortingPipeline(res.items);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setAppState('idle');
        setNotification('');
        return;
      }

      console.error(err);
      setAppState('idle');
      if (err?.message === 'FileSystemAccessUnsupported' || err?.name === 'SecurityError') {
        setErrorMessage('Native file access blocked. Use the "Browse via OS Dialog" button below.');
      } else {
        setErrorMessage('Could not open folder: ' + (err?.message || err));
      }
    }
  };

  // Handler for Universal Folder Input (<input type="file" webkitdirectory />)
  const handleUniversalFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setErrorMessage('');
    setAppState('scanning');
    vortexRef.current?.clear();
    setCards(new Map());
    setDirHandle(null);

    const { dirName: detectedName, items: parsedItems } = parseFileList(fileList);
    setDirName(detectedName);

    if (parsedItems.length === 0) {
      setAppState('idle');
      setNotification(`No loose files found in “${detectedName}”. It's already tidy!`);
      return;
    }

    await runSortingPipeline(parsedItems);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setErrorMessage('');
    setAppState('scanning');
    vortexRef.current?.clear();
    setCards(new Map());
    setDirHandle(null);

    const { dirName: detectedName, items: parsedItems } = parseFileList(files);
    setDirName(detectedName || 'Dropped Folder');

    if (parsedItems.length === 0) {
      setAppState('idle');
      setNotification('No files detected in the dropped folder.');
      return;
    }

    await runSortingPipeline(parsedItems);
  };

  // Handler for Demo Simulation Mode
  const handleRunDemo = async () => {
    setErrorMessage('');
    setAppState('scanning');
    setDirName('Sample Downloads (Simulation)');
    setDirHandle(null);
    vortexRef.current?.clear();
    setCards(new Map());

    const demoFiles = generateDemoFiles();
    await runSortingPipeline(demoFiles);
  };

  // Handler to Execute File Movement
  const handleExecuteMoves = async () => {
    if (dirHandle) {
      try {
        setAppState('moving');
        setMoveProgress({ done: 0, total: items.size });

        const log = await executeSortMoves(
          dirHandle,
          Array.from(items.values()),
          (done, total) => {
            setMoveProgress({ done, total });
          }
        );

        setUndoLog(log);
        setAppState('done');
        setNotification(`All files organized into “${SORTED_FOLDER_NAME}/” folder on your computer!`);
      } catch (err: any) {
        console.error('Move error:', err);
        setErrorMessage('Error moving files: ' + err.message);
        setAppState('review');
      }
    } else {
      try {
        setAppState('moving');
        setZipProgress(0);
        await exportSortedZip(
          Array.from(items.values()),
          `${dirName || 'Sorted'}_Organized`,
          (pct) => setZipProgress(pct)
        );
        setAppState('done');
        setNotification('Organized files exported & downloaded as a ZIP archive successfully!');
      } catch (err: any) {
        setErrorMessage('Failed to generate organized ZIP: ' + err.message);
        setAppState('review');
      }
    }
  };

  // Handler for Undo
  const handleUndo = async () => {
    if (!dirHandle || !undoLog) {
      setAppState('idle');
      setCards(new Map());
      setItems(new Map());
      vortexRef.current?.clear();
      setNotification('Reset back to initial state.');
      return;
    }

    try {
      setAppState('undoing');
      setNotification('Restoring files back to root directory...');
      await executeUndoMoves(dirHandle, undoLog);
      setAppState('idle');
      setCards(new Map());
      setItems(new Map());
      vortexRef.current?.clear();
      setNotification('Files restored to root folder successfully!');
    } catch (err: any) {
      setErrorMessage('Undo error: ' + err.message);
      setAppState('done');
    }
  };

  // Reset to idle
  const handleReset = () => {
    setAppState('idle');
    setCards(new Map());
    setItems(new Map());
    setDirName('');
    setDirHandle(null);
    setNotification('');
    setErrorMessage('');
    vortexRef.current?.clear();
  };

  // Coordinates locator for canvas particle landing
  // FALLBACK: If slotIndex is undefined (files 7 onwards), targets the card element itself!
  const getTargetLocation = useCallback((id: string) => {
    const item = items.get(id);
    if (!item || !item.cardKey) return null;

    let el: Element | null = null;
    if (item.slotIndex !== undefined) {
      el = document.querySelector(
        `[data-card="${item.cardKey}"] [data-slot="${item.slotIndex}"]`
      );
    }

    // Fallback directly to the category card container
    if (!el) {
      el = document.querySelector(`[data-card="${item.cardKey}"]`);
    }

    if (!el) return null;

    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: Math.min(rect.width, rect.height),
    };
  }, [items]);

  // On particle land callback
  const handleParticleLand = useCallback((id: string) => {
    const item = items.get(id);
    if (!item || !item.cardKey) return;

    setCards((prev) => {
      const card = prev.get(item.cardKey!);
      if (!card) return prev;
      return new Map(prev.set(item.cardKey!, { ...card, flash: performance.now() }));
    });
  }, [items]);

  // Exact mathematically derived stats
  const totalLoose = items.size;
  const totalMedia = Array.from(items.values()).filter(
    (i) => i.kind === 'photo' || i.kind === 'video'
  ).length;
  const totalFolders = cards.size;
  const totalDupes = Array.from(items.values()).filter((i) => i.isDuplicate).length;

  const photoCards = Array.from(cards.values()).filter((c) => c.section === 'photos');
  const videoCards = Array.from(cards.values()).filter((c) => c.section === 'videos');
  const fileCards = Array.from(cards.values()).filter((c) => c.section === 'files');
  const dupeCards = Array.from(cards.values()).filter((c) => c.section === 'dupes');

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-screen flex flex-col relative text-zinc-100 pb-16 transition-colors ${
        isDragOver ? 'bg-[#0f1424] ring-4 ring-brand-500/50' : 'bg-[#0b0d13]'
      }`}
    >
      {/* Hidden Universal File/Folder Input */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        // @ts-ignore
        directory="true"
        multiple
        onChange={handleUniversalFolderChange}
        className="hidden"
      />

      {/* Canvas Vortex Overlay */}
      <CanvasVortex
        getTarget={getTargetLocation}
        onLand={handleParticleLand}
        onVortexReady={(ctrl) => (vortexRef.current = ctrl)}
      />

      {/* Drag Overlay Hint */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-brand-950/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none border-4 border-dashed border-brand-400">
          <Upload className="w-16 h-16 text-brand-300 animate-bounce mb-4" />
          <h2 className="text-2xl font-bold text-white">Drop your folder here</h2>
          <p className="text-zinc-300 text-sm mt-1">We will scan and organize it with local AI</p>
        </div>
      )}

      {/* Security Explainer Modal */}
      {showSecurityExplainer && (
        <div
          onClick={() => setShowSecurityExplainer(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Chrome "Upload files?" Warning Explained</h3>
                <p className="text-xs text-zinc-400">Why does your browser show this security popup?</p>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-zinc-300 space-y-2.5 leading-relaxed bg-surface/60 p-4 rounded-xl border border-surface-border/50">
              <p>
                <strong>1. It is a standard browser security label:</strong> Whenever any webpage asks to read an entire folder on your computer via HTML file selection, Chromium browsers automatically display:
              </p>
              <blockquote className="border-l-2 border-brand-400 pl-3 py-1 text-zinc-400 italic text-xs bg-zinc-900/60 rounded-r">
                "Upload 193 files to this site? This will upload all files from 'Screenshots'..."
              </blockquote>
              <p>
                <strong>2. Zero network activity:</strong> The browser uses the word <em>"Upload"</em> generically for any local file picker, but <strong>nothing is sent over the internet or uploaded to any server</strong>.
              </p>
              <p>
                <strong>3. 100% In-Browser:</strong> All AI classification, thumbnail generation, and sorting runs completely inside your browser tab memory using WebAssembly & WebGPU.
              </p>
            </div>

            <button
              onClick={() => setShowSecurityExplainer(false)}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              Understood, Got it!
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight flex items-center gap-2">
                File Sorter
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand-900/50 text-brand-300 border border-brand-700/50">
                  Antigravity AI
                </span>
              </h1>
              <p className="text-xs text-zinc-400">On-Device AI Downloads & Folder Organizer</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* AI Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs">
              <Cpu className="w-3.5 h-3.5 text-brand-400" />
              {aiStatus.status === 'loading' && (
                <span className="text-amber-400">
                  AI Model downloading: {aiStatus.pct}%
                </span>
              )}
              {aiStatus.status === 'ready' && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AI Ready ({aiStatus.device})
                </span>
              )}
              {aiStatus.status === 'error' && (
                <span className="text-rose-400">AI Fallback: Type-Based</span>
              )}
              {aiStatus.status === 'idle' && (
                <span className="text-zinc-400">Initializing AI...</span>
              )}
            </div>

            {/* Privacy Badge */}
            <button
              onClick={() => setShowSecurityExplainer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/40 text-emerald-400 text-xs transition-colors"
              title="Click to learn how privacy is guaranteed"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-medium">100% On-Device</span>
              <HelpCircle className="w-3 h-3 text-emerald-500/80" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full space-y-6">
        {/* Target Directory & Selection Header */}
        <div className="text-center space-y-4 py-2">
          {/* Active Folder Indicator */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs text-zinc-300 shadow-md">
            <FolderOpen className="w-4 h-4 text-brand-400" />
            <span>Target Directory:</span>
            <span className="text-zinc-100 font-bold bg-surface px-2.5 py-0.5 rounded border border-surface-border/50">
              {dirName || 'None selected (Choose a folder below)'}
            </span>
            {dirName && appState !== 'scanning' && appState !== 'sorting' && appState !== 'moving' && (
              <button
                onClick={handleReset}
                className="ml-1 text-zinc-400 hover:text-white text-xs underline flex items-center gap-1"
                title="Change folder"
              >
                <RefreshCw className="w-3 h-3" /> Change
              </button>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="max-w-xl mx-auto p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-center gap-2.5 text-left">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Area */}
          <div className="space-y-3">
            {appState === 'idle' && (
              <div className="space-y-4">
                {/* Single Unified Main Action Button */}
                <div className="flex flex-col items-center justify-center gap-3">
                  <button
                    onClick={() => handlePickDirectory()}
                    className="px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-3 shadow-xl shadow-brand-600/30 transition-all hover:scale-105 active:scale-95 text-base sm:text-lg"
                  >
                    <FolderOpen className="w-6 h-6" />
                    Select Folder to Sort
                  </button>

                  {/* Quick Folder Shortcuts */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-zinc-400">
                    <span className="text-zinc-500">Quick folders:</span>
                    <button
                      onClick={() => handlePickDirectory('downloads')}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      📥 Downloads
                    </button>
                    <button
                      onClick={() => handlePickDirectory('desktop')}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      🖥️ Desktop
                    </button>
                    <button
                      onClick={() => handlePickDirectory('documents')}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      📄 Documents
                    </button>
                    <button
                      onClick={() => handlePickDirectory('pictures')}
                      className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      🖼️ Pictures
                    </button>
                  </div>

                  {/* Subtle Simulation Link */}
                  <div className="pt-2">
                    <button
                      onClick={handleRunDemo}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:underline transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 text-amber-400" />
                      Or try simulation with sample demo files
                    </button>
                  </div>
                </div>
              </div>
            )}

            {appState === 'scanning' && (
              <div className="inline-flex px-6 py-3 rounded-xl bg-surface-card border border-surface-border text-zinc-300 items-center gap-3 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
                Reading folder entries...
              </div>
            )}

            {appState === 'sorting' && (
              <div className="inline-flex px-6 py-3 rounded-xl bg-brand-950/60 border border-brand-800 text-brand-300 items-center gap-3">
                <Sparkles className="w-5 h-5 animate-spin" />
                Sorting with Vision AI & Rule Engine...
              </div>
            )}

            {appState === 'review' && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleExecuteMoves}
                  className="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 text-base"
                >
                  {dirHandle ? (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      Move {totalLoose} Files to "Sorted/" Folder
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Export Organized ZIP ({totalLoose} Files)
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-3.5 rounded-xl bg-surface-card hover:bg-surface-hover border border-surface-border text-zinc-400 hover:text-zinc-200 font-medium text-sm transition-all"
                >
                  Cancel / Pick Another Folder
                </button>
              </div>
            )}

            {appState === 'moving' && (
              <div className="inline-flex px-6 py-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {dirHandle
                  ? `Moving files: ${moveProgress.done} / ${moveProgress.total}`
                  : `Creating organized ZIP: ${zipProgress || 0}%`}
              </div>
            )}

            {appState === 'done' && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {dirHandle && undoLog && (
                  <button
                    onClick={handleUndo}
                    className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    Undo Moves
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  Sort Another Folder
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Status Notification */}
          {notification && (
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto flex items-center justify-center gap-2 pt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {notification}
            </p>
          )}
        </div>

        {/* Stats Bar */}
        {cards.size > 0 && (
          <StatsBar
            looseFiles={totalLoose}
            photos={totalMedia}
            foldersCreated={totalFolders}
            duplicatesFound={totalDupes}
          />
        )}

        {/* Category Cards Board */}
        {cards.size > 0 ? (
          <div className="space-y-8 pt-4">
            {/* 1. Photos Section */}
            {photoCards.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  Photos (Zero-Shot AI Classification)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {photoCards.map((c) => (
                    <CategoryCard
                      key={c.key}
                      card={c}
                      itemsMap={items}
                      onClick={() => setSelectedCardKey(c.key)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 2. Videos Section */}
            {videoCards.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Videos & Screen Recordings
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {videoCards.map((c) => (
                    <CategoryCard
                      key={c.key}
                      card={c}
                      itemsMap={items}
                      onClick={() => setSelectedCardKey(c.key)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. Non-Media Files Section */}
            {fileCards.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Documents & Other Files
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {fileCards.map((c) => (
                    <CategoryCard
                      key={c.key}
                      card={c}
                      itemsMap={items}
                      onClick={() => setSelectedCardKey(c.key)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 4. Duplicates Section */}
            {dupeCards.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Duplicate Files (Isolated for Safe Deletion)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {dupeCards.map((c) => (
                    <CategoryCard
                      key={c.key}
                      card={c}
                      itemsMap={items}
                      onClick={() => setSelectedCardKey(c.key)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Empty State Dropzone */
          <div
            onClick={() => handlePickDirectory()}
            className="border-2 border-dashed border-surface-border hover:border-brand-500/60 bg-surface-card/30 hover:bg-surface-card/60 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 mt-6 cursor-pointer transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-2xl bg-surface-border flex items-center justify-center mx-auto text-3xl">
              📂
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-100">
                Click to Select Any Folder or Drag & Drop Here
              </h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Select your <strong>Downloads, Desktop, Documents, or any custom folder</strong>. Photos, videos, and files are analyzed 100% on-device with zero server uploads.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
              <div className="p-4 rounded-xl bg-surface/60 border border-surface-border/50 space-y-1">
                <div className="text-xs font-semibold text-brand-400">1. Any Folder</div>
                <div className="text-xs text-zinc-400">Not just Downloads. Choose any folder on your hard drive.</div>
              </div>
              <div className="p-4 rounded-xl bg-surface/60 border border-surface-border/50 space-y-1">
                <div className="text-xs font-semibold text-brand-400">2. Local AI Vision</div>
                <div className="text-xs text-zinc-400">Classifies photos & video frames directly on your GPU.</div>
              </div>
              <div className="p-4 rounded-xl bg-surface/60 border border-surface-border/50 space-y-1">
                <div className="text-xs font-semibold text-brand-400">3. Non-Destructive</div>
                <div className="text-xs text-zinc-400">Files are safely sorted with full 1-click Undo protection.</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Category Inspect Modal */}
      <FileDetailsModal
        card={selectedCardKey ? cards.get(selectedCardKey) || null : null}
        onClose={() => setSelectedCardKey(null)}
      />
    </div>
  );
};
