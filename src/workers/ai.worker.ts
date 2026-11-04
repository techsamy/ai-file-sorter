import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@huggingface/transformers';

// Configure environment
env.allowLocalModels = false;

const MODEL_ID = 'Xenova/clip-vit-base-patch32';

let tokenizer: any = null;
let textModel: any = null;
let processor: any = null;
let visionModel: any = null;

let promptCategories: string[] = [];
let categoryKeys: string[] = [];
let textEmbeddings: Float32Array[] = [];
let initPromise: Promise<void> | null = null;

function l2Norm(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i] / norm;
  }
  return out;
}

function progressCallback(e: any) {
  if (e.status === 'progress' && e.total) {
    self.postMessage({
      type: 'progress',
      file: e.file,
      loaded: e.loaded,
      total: e.total,
    });
  }
}

async function loadModels(categories: { key: string; prompts: string[] }[]) {
  let device: 'webgpu' | 'wasm' = 'wasm';
  let dtype: 'fp16' | 'q8' = 'q8';

  // Check WebGPU availability
  if (self.navigator && (self.navigator as any).gpu) {
    try {
      const adapter = await (self.navigator as any).gpu.requestAdapter();
      if (adapter) {
        device = 'webgpu';
        dtype = 'fp16';
      }
    } catch (e) {
      console.warn('WebGPU check failed, falling back to WASM:', e);
      device = 'wasm';
      dtype = 'q8';
    }
  }

  // Load CLIP components
  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
  textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
    device,
    dtype,
    progress_callback: progressCallback,
  });

  processor = await AutoProcessor.from_pretrained(MODEL_ID);
  visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
    device,
    dtype,
    progress_callback: progressCallback,
  });

  // Pre-compute text embeddings for all category prompts
  const allPrompts: string[] = [];
  const allKeys: string[] = [];

  for (const cat of categories) {
    for (const prompt of cat.prompts) {
      allPrompts.push(prompt);
      allKeys.push(cat.key);
    }
  }

  promptCategories = allKeys;
  categoryKeys = categories.map((c) => c.key);

  const tokenized = tokenizer(allPrompts, { padding: true, truncation: true });
  const { text_embeds } = await textModel(tokenized);
  const dim = text_embeds.dims[1];
  const data = text_embeds.data;

  textEmbeddings = allPrompts.map((_, i) => {
    const slice = data.slice(i * dim, (i + 1) * dim);
    return l2Norm(slice);
  });

  self.postMessage({ type: 'ready', device });
}

async function classifyImage(id: string, blob: Blob) {
  if (!visionModel || !processor || !textEmbeddings.length) {
    throw new Error('AI Model is not ready yet');
  }

  const rawImage = await RawImage.fromBlob(blob);
  const imageInputs = await processor(rawImage);
  const { image_embeds } = await visionModel(imageInputs);
  const imgVec = l2Norm(image_embeds.data);

  // Compute cosine similarity scaled by 100
  const similarities = textEmbeddings.map((textVec) => {
    let dot = 0;
    for (let i = 0; i < textVec.length; i++) {
      dot += textVec[i] * imgVec[i];
    }
    return dot * 100;
  });

  // Softmax
  const maxScore = Math.max(...similarities);
  const exps = similarities.map((s) => Math.exp(s - maxScore));
  const sumExps = exps.reduce((a, b) => a + b, 0);

  // Accumulate probabilities per category key
  const catScores: Record<string, number> = {};
  for (const k of categoryKeys) catScores[k] = 0;

  exps.forEach((expVal, idx) => {
    const key = promptCategories[idx];
    catScores[key] = (catScores[key] || 0) + expVal / sumExps;
  });

  // Find argmax
  let bestKey = categoryKeys[0];
  let highest = -1;
  for (const [key, score] of Object.entries(catScores)) {
    if (score > highest) {
      highest = score;
      bestKey = key;
    }
  }

  self.postMessage({
    type: 'result',
    id,
    category: bestKey,
    confidence: highest,
  });
}

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'init') {
    initPromise = loadModels(data.categories).catch((err) => {
      self.postMessage({
        type: 'error',
        error: String(err && err.message ? err.message : err),
      });
    });
  } else if (data.type === 'classify') {
    try {
      if (initPromise) await initPromise;
      await classifyImage(data.id, data.blob);
    } catch (err: any) {
      self.postMessage({
        type: 'result',
        id: data.id,
        category: null,
        error: String(err?.message || err),
      });
    }
  }
};

