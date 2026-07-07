# RootFacts

A web application that identifies vegetables through the device camera and generates a unique fun fact about the detected vegetable. Two AI models run entirely in the browser — no server-side processing required.

**Live demo:** https://rootfacts-ai-dicoding.netlify.app

---

## Overview

RootFacts combines two AI capabilities:

1. **Computer Vision** — A TensorFlow.js model watches the camera feed and classifies the vegetable it sees.
2. **Generative AI** — Once a vegetable is identified, a language model (Transformers.js) generates a short, context-aware fun fact about it.

Both models are loaded and executed on the client side, which means the application works offline after the first visit.

---

## Features

- Real-time vegetable detection via device camera
- Fun fact generation with selectable writing style (Normal, Funny, Professional, Casual)
- Copy generated fact to clipboard
- Configurable FPS limit (15 / 30 / 45 / 60)
- Adaptive GPU backend — uses WebGPU when available, falls back to WebGL for TensorFlow.js and WebAssembly for Transformers.js
- Memory-safe inference using `tf.tidy()` to prevent tensor leaks
- Loading progress indicator during model initialization
- Progressive Web App — installable on desktop and mobile
- Offline support via Service Worker precaching (including the AI model files)

---

## About the Dataset and Model

The detection model was not trained as part of this project. It was provided as a pre-trained model by Dicoding, trained using **Google Teachable Machine** — a browser-based tool that lets anyone train an image classification model without writing code.

The training process works like this:

1. Photos of each vegetable are collected and grouped by label (e.g. a folder of carrot photos, a folder of potato photos, and so on).
2. Teachable Machine uses those photos to train a neural network that learns the visual differences between categories.
3. The trained model is exported in TensorFlow.js format — three files: `model.json` (the network structure), `weights.bin` (the learned parameters), and `metadata.json` (the list of class labels).

Those three files sit in `public/model/` and are loaded directly in the browser at runtime. Nothing is sent to a server.

**Why accuracy is limited:** The model was trained on a relatively small and controlled dataset. Detection works best when the vegetable is well-lit, centered in the frame, and placed against a plain background. In cluttered or low-light conditions the model may misidentify the object — this is expected behavior for a model of this scale.

---

## Supported Vegetables

The detection model was trained to recognize the following 18 classes:

Beetroot, Paprika, Cabbage, Carrot, Cauliflower, Chilli, Corn, Cucumber, Eggplant, Garlic, Ginger, Lettuce, Onion, Peas, Potato, Turnip, Soybean, Spinach

---

## How It Works

### Detection flow

```
Camera stream
    |
    v
Canvas frame capture  (at configured FPS interval)
    |
    v
tf.browser.fromPixels()
    --> resize to 224x224
    --> normalize [-1, 1]
    --> model.predict()  (inside tf.tidy for memory safety)
    |
    v
Top predicted label + confidence score
    |
    v  (if confidence >= 70% and label changed)
Trigger fun fact generation
```

### Fun fact generation flow

```
Detected vegetable label
    |
    v
Build prompt based on selected tone
    |
    v
Transformers.js pipeline (text2text-generation)
    Model: Xenova/LaMini-Flan-T5-77M  (quantized q4)
    max_new_tokens: 150
    temperature: 0.8
    top_p: 0.9
    do_sample: true
    |
    v
Display generated text in UI
```

### Adaptive backend selection

At startup the application checks `navigator.gpu`:

- **TensorFlow.js**: WebGPU → WebGL (fallback)
- **Transformers.js**: WebGPU → WebAssembly (fallback)

This allows faster inference on devices with capable GPUs while remaining compatible with older hardware.

---

## Project Structure

```
root-facts-llm&cv/
├── public/
│   ├── model/
│   │   ├── model.json        # TensorFlow.js model topology
│   │   ├── weights.bin       # Model weights
│   │   └── metadata.json     # Class labels and image size
│   └── icons/                # PWA icons
├── src/
│   ├── services/
│   │   ├── DetectionService.js   # TF.js model loading and prediction
│   │   ├── CameraService.js      # MediaStream management and frame capture
│   │   └── RootFactsService.js   # Transformers.js pipeline and tone config
│   ├── components/
│   │   ├── Header.jsx            # Status bar with loading progress
│   │   ├── CameraSection.jsx     # Camera feed, controls, FPS slider, tone selector
│   │   └── InfoPanel.jsx         # Detection result and fun fact display
│   ├── hooks/
│   │   └── useAppState.js        # Global state via useReducer
│   ├── utils/
│   │   ├── config.js             # App constants and tone definitions
│   │   ├── common.js             # Shared helpers (WebGPU check, error messages)
│   │   └── ui.js                 # Shared style objects
│   ├── App.jsx                   # Root component, orchestrates services and loop
│   └── main.jsx                  # React entry point
├── vite.config.js                # Vite + vite-plugin-pwa configuration
├── eslint.config.mjs             # ESLint with eslint-config-dicodingacademy
└── STUDENT.txt                   # Deployment URL
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Build tool | Vite 6 |
| Computer Vision | TensorFlow.js 4.22 |
| GPU backend (CV) | @tensorflow/tfjs-backend-webgpu |
| Generative AI | @huggingface/transformers 3.x |
| LLM model | Xenova/LaMini-Flan-T5-77M (q4) |
| PWA | vite-plugin-pwa + Workbox |
| Icons | lucide-react |
| Linter | ESLint + eslint-config-dicodingacademy |

---

## Getting Started

**Requirements:** Node.js 18 or later

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The development server runs on `http://localhost:3001`.

---

## Configuration

Key constants are in `src/utils/config.js`:

| Constant | Default | Description |
|---|---|---|
| `detectionConfidenceThreshold` | `70` | Minimum confidence (%) to trigger fun fact |
| `analyzingDelay` | `2000` | Milliseconds to show "analyzing" state |
| `factsGenerationDelay` | `2000` | Cooldown before re-generating for same label |

FPS can be adjusted at runtime using the slider in the camera controls (15 to 60).

---

## PWA and Offline Support

The Service Worker generated by Workbox precaches:

- All compiled JS, CSS, and HTML assets
- `public/model/model.json`, `metadata.json`, and `weights.bin`
- App icons

After the initial load completes, the detection model runs fully offline. The language model (Transformers.js) downloads its weights from Hugging Face on first use; those weights are cached by the browser for subsequent offline sessions.

To install the app, look for the install button in the browser address bar, or use "Add to Home Screen" on mobile.

---

## Usage Tips

- Point the camera at the vegetable against a plain background in good lighting for the most stable detection.
- The model was trained on a limited dataset — accuracy varies by lighting and angle.
- Switch the writing style using the tone selector before starting the scan.
- After a fun fact appears, tap the copy button to copy the text to your clipboard.
- The scan button is disabled until both AI models have finished loading (progress shown in the header).

---

## License

This project was built as a final submission for the Dicoding learning path on AI integration for the web.
