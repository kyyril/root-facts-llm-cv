import { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';
import { createDelay, logError } from './utils/common';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const lastDetectedRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const [currentTone, setCurrentTone] = useState('normal');
  const [loadingPct, setLoadingPct] = useState(0);

  useEffect(() => {
    const detector = new DetectionService();
    const camera = new CameraService();
    const generator = new RootFactsService();

    actions.setServices({ detector, camera, generator });
    actions.setModelStatus('Memuat Model AI... 0%');

    let tfPct = 0;
    let llmPct = 0;

    const updateStatus = () => {
      const avg = Math.round((tfPct + llmPct) / 2);
      setLoadingPct(avg);
      if (avg < 100) {
        actions.setModelStatus(`Memuat Model AI... ${avg}%`);
      } else {
        actions.setModelStatus('Model AI Siap');
      }
    };

    const onTFProgress = (pct) => {
      tfPct = pct;
      updateStatus();
    };

    const onLLMProgress = (pct) => {
      llmPct = pct;
      updateStatus();
    };

    Promise.all([
      detector.loadModel(onTFProgress),
      generator.loadModel(onLLMProgress),
    ]).catch((err) => {
      logError('Model loading', err);
      actions.setError('Gagal memuat model AI. Silakan refresh halaman.');
    });

    return () => {
      camera.stopCamera();
    };
  }, []);

  const runDetectionLoop = (detector, camera, generator) => {
    const loop = async () => {
      if (!isRunningRef.current) return;

      const now = Date.now();
      const interval = camera.getFPSInterval ? camera.getFPSInterval() : 1000 / 30;
      const elapsed = now - lastFrameTimeRef.current;

      if (elapsed >= interval) {
        lastFrameTimeRef.current = now;

        if (camera.isReady() && detector.isLoaded()) {
          const frame = camera.captureFrame();
          if (frame) {
            const result = await detector.predict(frame);
            if (isValidDetection(result)) {
              const isSame = lastDetectedRef.current === result.className;
              if (!isSame) {
                lastDetectedRef.current = result.className;
                actions.setDetectionResult({
                  className: result.className,
                  score: result.score,
                  confidence: result.confidence,
                });
                actions.setAppState('analyzing');

                await createDelay(APP_CONFIG.analyzingDelay);
                if (!isRunningRef.current) return;

                actions.setAppState('result');
                actions.setFunFactData(null);

                if (generator.isReady()) {
                  try {
                    const fact = await generator.generateFacts(result.className);
                    if (isRunningRef.current) {
                      actions.setFunFactData(fact || 'error');
                    }
                  } catch (err) {
                    logError('generateFacts', err);
                    actions.setFunFactData('error');
                  }
                }
              }
            }
          }
        }
      }

      if (isRunningRef.current) {
        detectionCleanupRef.current = requestAnimationFrame(loop);
      }
    };

    detectionCleanupRef.current = requestAnimationFrame(loop);
  };

  const handleToggleCamera = async () => {
    const { detector, camera, generator } = state.services;
    if (!detector || !camera) return;

    if (isRunningRef.current) {
      isRunningRef.current = false;
      if (detectionCleanupRef.current) {
        cancelAnimationFrame(detectionCleanupRef.current);
      }
      camera.stopCamera();
      actions.setRunning(false);
      actions.resetResults();
      lastDetectedRef.current = null;
    } else {
      try {
        await camera.startCamera();
        isRunningRef.current = true;
        actions.setRunning(true);
        actions.resetResults();
        lastDetectedRef.current = null;
        lastFrameTimeRef.current = 0;
        runDetectionLoop(detector, camera, generator);
      } catch (err) {
        logError('startCamera', err);
        actions.setError(err.message);
      }
    }
  };

  const handleToneChange = (tone) => {
    setCurrentTone(tone);
    const { generator } = state.services;
    if (generator) {
      generator.setTone(tone);
    }
  };

  const handleCopyFact = async () => {
    if (state.funFactData && state.funFactData !== 'error') {
      try {
        await navigator.clipboard.writeText(state.funFactData);
      } catch (err) {
        logError('clipboard', err);
      }
    }
  };

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} loadingPct={loadingPct} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js &amp; Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
