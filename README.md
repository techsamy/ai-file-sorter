# 📁 File Sorter

An on-device, privacy-preserving AI Downloads & file organizer inspired by Shakir Cheppali's File Sorter ([shakirc.com/file-sorter](https://www.shakirc.com/file-sorter)).

## ✨ Features

- **100% On-Device & Private:** Zero server uploads. Files never leave your browser.
- **Multimodal AI Classification:** Runs CLIP (`Xenova/clip-vit-base-patch32`) inside a Web Worker with WebGPU hardware acceleration (and WASM SIMD fallback).
- **Zero-Shot Semantic Image Sorting:** Identifies selfies, travel, receipts, documents, food, cars, nature, aesthetic rooms, memes, and screenshots.
- **Smart Duplicate Detection:** Two-tier detection with file size grouping and 8 MB partial SHA-256 hashing.
- **Interactive 2D Canvas Vortex:** Files swirl in an orbit and animate directly into target folder cards upon classification.
- **Physical Landing Mechanics:** Card counters and thumbnail previews update dynamically as particles physically arrive.
- **Non-destructive & Reversible:** Complete collision resolution (`file (1).ext`) and a one-click Undo system backed by JSON logs.
- **Simulation Demo Mode:** Instant one-click testing without touching real files.

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in Google Chrome, Microsoft Edge, or any Chromium-based browser.

### 3. Production Build
```bash
npm run build
npm run preview
```
Output static files are generated in `dist/`.

---

## 📚 Documentation (`.docs/`)

- [aaPanel Static Deployment Guide](.docs/AAPANEL_GUIDE.md) (`sorter.samytech.site`)
- [System Architecture & AI Pipeline Deep Dive](.docs/ARCHITECTURE.md)

---

## 🛠️ Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Lucide Icons
- **AI Engine:** `@huggingface/transformers` (v3) + ONNX Runtime Web
- **Browser APIs:** File System Access API (`showDirectoryPicker`), Web Workers, OffscreenCanvas, Web Crypto API
