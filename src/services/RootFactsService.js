import { pipeline } from '@huggingface/transformers';
import { isWebGPUSupported } from '../utils/common.js';
import { TONE_CONFIG } from '../utils/config.js';

const TONE_PROMPTS = {
  normal: 'Write one interesting fun fact about {vegetable} in English. Be concise.',
  funny:
    'Write one hilarious and witty fun fact about {vegetable} in English. Be funny and entertaining.',
  professional:
    'Write one scientifically accurate and informative fun fact about {vegetable} in English. Use formal tone.',
  casual:
    'Write one fun and relaxed fun fact about {vegetable} in English. Keep it friendly and simple.',
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel(onProgress) {
    const device = isWebGPUSupported() ? 'webgpu' : 'wasm';
    this.currentBackend = device;

    if (onProgress) onProgress(10);

    this.generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M', {
      dtype: 'q4',
      device,
      progress_callback: (progress) => {
        if (onProgress && progress.status === 'progress') {
          const pct = Math.round((progress.loaded / progress.total) * 80) + 10;
          onProgress(Math.min(pct, 90));
        }
      },
    });

    this.isModelLoaded = true;
    if (onProgress) onProgress(100);
  }

  setTone(tone) {
    const validTones = TONE_CONFIG.availableTones.map((t) => t.value);
    if (validTones.includes(tone)) {
      this.currentTone = tone;
    }
  }

  async generateFacts(vegetableName) {
    if (!this.isReady() || this.isGenerating) return null;

    this.isGenerating = true;
    try {
      const promptTemplate = TONE_PROMPTS[this.currentTone] || TONE_PROMPTS.normal;
      const prompt = promptTemplate.replace('{vegetable}', vegetableName);

      const output = await this.generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.8,
        top_p: 0.9,
        do_sample: true,
      });

      const text = output?.[0]?.generated_text || '';
      return text.trim();
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}
