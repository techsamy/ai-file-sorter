# 🌐 aaPanel Deployment Guide for `sorter.samytech.site`

This guide explains how to deploy **File Sorter** as a high-performance static web app on aaPanel (zero Docker, zero Node.js overhead on server).

---

## 🏗️ Architecture Overview

```
User (Browser)
    │  HTTPS (Port 443)
    ▼
aaPanel Nginx Gateway (`sorter.samytech.site`)
    │  • SSL Termination (Let's Encrypt)
    │  • COOP / COEP Isolation Headers
    │  • Static File Serving (HTML, CSS, JS, WASM)
    ▼
Client Browser (V8 Engine)
    • Multimodal CLIP Zero-Shot AI (WebGPU / WASM SIMD)
    • 100% on-device file sorting & duplicate detection
```

---

## 🛠️ Step-by-Step Deployment in aaPanel

### Step 1: Add Website in aaPanel
1. Go to **Website** in aaPanel sidebar $\rightarrow$ Click **Add site**.
   - **Domain:** `sorter.samytech.site`
   - **Database:** `Do not create`
   - **PHP Version:** `Pure HTML` (static)
2. Click **Submit**.

---

### Step 2: Issue Free SSL (Let's Encrypt)
1. Go to Website list $\rightarrow$ Click **Conf** next to `sorter.samytech.site`.
2. Select **SSL** tab $\rightarrow$ Choose **Let's Encrypt**.
3. Select `sorter.samytech.site` and click **Apply**.
4. Enable **"Force HTTPS"** toggle.

---

### Step 3: Upload Static Files (`dist.zip`)
1. In aaPanel, navigate to **Files** $\rightarrow$ `/www/wwwroot/sorter.samytech.site`.
2. Delete default placeholder files (`index.html`, `404.html`).
3. Upload **`dist.zip`** (generated from `npm run build`).
4. Click **Uncompress / Extract**.
5. Ensure `index.html` and `assets/` folder are at the root of `/www/wwwroot/sorter.samytech.site/`.

---

### Step 4: Configure Nginx Isolation Headers
1. Go to Website Settings $\rightarrow$ **Config** (or Configuration file).
2. Inside the `server { ... }` block, add:

```nginx
    # WebGPU & Multithreading Isolation Headers (Crucial for Client AI)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "credentialless" always;

    # SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Embedder-Policy "credentialless" always;
    }

    # WebAssembly MIME Type Handler
    location ~* \.wasm$ {
        default_type application/wasm;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Embedder-Policy "credentialless" always;
    }
```
3. Click **Save**.

---

## 🧪 Verification

Open:
```text
https://sorter.samytech.site/
```
Check that the top-right badge shows `● AI Ready (wasm / webgpu)`.
