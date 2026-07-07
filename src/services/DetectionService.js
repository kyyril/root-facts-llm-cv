import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { isWebGPUSupported, validateModelMetadata } from '../utils/common.js';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
  }

  async loadModel(onProgress) {
    if (isWebGPUSupported()) {
      try {
        await tf.setBackend('webgpu');
        await tf.ready();
        this.currentBackend = 'webgpu';
      } catch {
        await tf.setBackend('webgl');
        await tf.ready();
        this.currentBackend = 'webgl';
      }
    } else {
      await tf.setBackend('webgl');
      await tf.ready();
      this.currentBackend = 'webgl';
    }

    if (onProgress) onProgress(10);

    const [modelResponse, metaResponse] = await Promise.all([
      fetch('/model/model.json'),
      fetch('/model/metadata.json'),
    ]);

    if (onProgress) onProgress(40);

    const metadata = await metaResponse.json();
    if (!validateModelMetadata(metadata)) {
      throw new Error('Invalid model metadata');
    }
    this.labels = metadata.labels;
    this.config = metadata;

    if (onProgress) onProgress(60);

    const modelUrl = URL.createObjectURL(await modelResponse.blob());
    this.model = await tf.loadLayersModel(
      modelUrl.replace('blob:', '') ? '/model/model.json' : modelUrl
    );

    if (onProgress) onProgress(90);

    const warmupTensor = tf.zeros([1, metadata.imageSize, metadata.imageSize, 3]);
    tf.tidy(() => this.model.predict(warmupTensor));
    warmupTensor.dispose();

    if (onProgress) onProgress(100);
  }

  async predict(imageElement) {
    if (!this.isLoaded()) return null;

    const imageSize = this.config?.imageSize || 224;

    const result = tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(imageElement)
        .resizeBilinear([imageSize, imageSize])
        .toFloat()
        .div(127.5)
        .sub(1)
        .expandDims(0);

      const predictions = this.model.predict(tensor);
      const scores = predictions.dataSync();
      return Array.from(scores);
    });

    let maxIdx = 0;
    let maxScore = result[0];
    for (let i = 1; i < result.length; i++) {
      if (result[i] > maxScore) {
        maxScore = result[i];
        maxIdx = i;
      }
    }

    return {
      className: this.labels[maxIdx],
      score: maxScore,
      confidence: Math.round(maxScore * 100),
      isValid: true,
    };
  }

  isLoaded() {
    return this.model !== null && this.labels.length > 0;
  }
}
