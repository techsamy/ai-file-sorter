# 🏛️ File Sorter Architecture & Technical Deep Dive

This document details the internal architecture, algorithms, AI pipeline, and browser subsystems that power **File Sorter**.

---

## 1. High-Level System Architecture

```
User Folder
    │
    ▼
[ Folder Scanner & Discovery Engine ]
    ├── showDirectoryPicker() [Secure / Chromium]
    └── <input type="file" webkitdirectory /> [Universal Fallback]
    │
    ├─────────────────────────────────────────┐
    ▼                                         ▼
[ Non-Media / Code Engine ]              [ Media Processing Pipeline ]
  • Extension & MIME matching              • File Size Clustering
  • Instant Rule-Based Sorting             • Web Crypto Partial SHA-256 (Duplicates)
                                           • OffscreenCanvas 64px Sprite Generator
                                           • <video> Keyframe Extractor
                                                      │
                                                      ▼
                                         [ Web Worker (ai.worker.ts) ]
                                           • Xenova/clip-vit-base-patch32
                                           • WebGPU Hardware Acceleration
                                           • WASM SIMD Fallback
                                           • Zero-Shot Semantic Classification
                                                      │
                                                      ▼
                                         [ Classification Stream ]
    ┌─────────────────────────────────────────────────┘
    ▼
[ 2D Canvas Physics Vortex ]
  • Center orbital swirl
  • Interpolated flight trajectory to target card slot
  • Physical Arrival Detection (handleParticleLand)
    │
    ▼
[ Category Cards & Live Counter ]
  • Dynamic badge counts (+1 on landing)
  • 6-slot preview thumbnail cascade
    │
    ▼
[ Execution Engine ]
  • In-Place File System Moves (with collision detection & undo JSON log)
  • Client-side JSZip archive generation
```

---

## 2. Core Subsystems

### A. Two-Tier Duplicate Detection (`src/services/duplicateDetector.ts`)
Sorting hundreds of files by computing full SHA-256 hashes would freeze browser threads. Instead, a two-phase optimization is used:
1. **Tier 1 (Size Clustering):** Group all files by exact byte size. Any file with a unique size is instantly marked unique in $O(1)$.
2. **Tier 2 (Partial SHA-256 Hashing):** For files sharing the exact byte size, the first 8 MB chunk is read and hashed using the browser's native `crypto.subtle.digest('SHA-256', buffer)`. Identical hashes are grouped into the **Duplicates** category.

### B. Thumbnail & Sprite Generator (`src/services/thumbnailService.ts`)
- Utilizes `OffscreenCanvas` where available to keep the main thread fluid.
- Resizes images to a uniform 64x64px square (preserving aspect ratio via centered crop).
- Extracts keyframes from videos by seeking to $t=0.5s$ or $25\%$ duration via a detached HTML5 `<video>` element.
- Fallback SVG icons are rendered for non-media files (PDF, Code, Archives, Spreadsheets).

### C. Multimodal AI Engine (`src/workers/ai.worker.ts`)
- Runs in a dedicated **Web Worker** using `@huggingface/transformers` (v3) and ONNX Runtime Web.
- **Hardware Acceleration:** First attempts `device: 'webgpu'` with `dtype: 'fp16'`. If unsupported, seamlessly falls back to `device: 'wasm'` with 8-bit quantized weights (`dtype: 'q8'`).
- **Zero-Shot CLIP Classification:** Image embeddings are projected against candidate text embeddings:
  - *"a selfie or photo of people"*
  - *"a computer screenshot or mobile screen capture"*
  - *"a company logo, graphic icon, or vector illustration"*
  - *"a photo of travel, scenic nature, outdoors, or vacation"*
  - *"a document, receipt, paper, or invoice"*
  - *"food, drinks, or culinary dish"*
  - *"a car, vehicle, motorcycle, or transport"*
  - *"an aesthetic room, interior design, or architecture"*
  - *"a funny meme or comic"*

### D. 2D Particle Vortex & Physical Landing (`src/components/CanvasVortex.tsx`)
Unlike simple loading bars, the vortex visualizes real-time file flow:
1. **Orbital Phase:** Files are injected into a central vortex orbiting at variable radius and angular velocity.
2. **Flight Phase:** Once a file's category is resolved, a destination vector is calculated pointing to that card's slot or container.
3. **Physical Landing:** The card count does **not** increment upon classification. It only increments when the particle touches its bounding box on screen (`onParticleLand`), creating visual fidelity and physical feedback.

### E. Native File System Access vs In-Memory Fallback (`src/services/fsService.ts`)
- **Native Context (Chromium):** Uses `window.showDirectoryPicker({ mode: 'readwrite' })`. Allows true zero-copy file moves directly on the user's hard drive without duplicating bytes.
- **Universal Fallback (Non-Chromium / Non-HTTPS LAN):** Falls back to `<input type="file" webkitdirectory />`. Allows the user to download an organized ZIP archive generated client-side via `JSZip`.

---

## 3. Directory Layout

```
/var/www/html/file-sorter/
├── .docs/
│   ├── ARCHITECTURE.md          # Internal system architecture & algorithms
│   └── DOCKER_GUIDE.md          # Container setup, deployment, & proxy guides
├── src/
│   ├── components/
│   │   ├── CanvasVortex.tsx     # 2D canvas particle vortex & flight trajectories
│   │   ├── CategoryCard.tsx     # Folder preview cards with landed file slots
│   │   ├── FileDetailsModal.tsx # Inspection modal for categorized items
│   │   ├── Header.tsx           # Navigation bar with AI status badge
│   │   └── StatsBar.tsx         # Real-time counter metrics
│   ├── constants/
│   │   └── categories.ts        # Zero-shot prompts, extensions, regex patterns
│   ├── services/
│   │   ├── duplicateDetector.ts # Tiered duplicate hashing engine
│   │   ├── fsService.ts         # Native file system picker, moves, & undo log
│   │   └── thumbnailService.ts  # OffscreenCanvas sprite & video frame extractor
│   ├── types/
│   │   └── index.ts             # TypeScript definitions
│   ├── workers/
│   │   └── ai.worker.ts         # WebGPU / WASM CLIP inference worker
│   ├── App.tsx                  # Main application state & widescreen layout
│   └── main.tsx                 # React entry point
├── Dockerfile                   # Multi-stage Alpine container build
├── docker-compose.yml           # Compose service definition (Port 8080)
├── nginx.conf                   # Nginx config with COOP/COEP & WASM MIME
└── package.json                 # Project dependencies & scripts
```
