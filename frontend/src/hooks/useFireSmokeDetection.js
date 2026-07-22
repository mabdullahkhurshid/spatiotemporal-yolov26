import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import api from '../services/api';

let modelPromise = null;

async function getModel(modelUrl) {
  if (!modelPromise) {
    await tf.setBackend('webgl');
    await tf.ready();
    modelPromise = tf.loadGraphModel(modelUrl);
  }
  return modelPromise;
}

const FIRE_THRESHOLD = Number(import.meta.env.VITE_FIRE_THRESHOLD || 70);
const SMOKE_THRESHOLD = Number(import.meta.env.VITE_SMOKE_THRESHOLD || 70);
const MIN_CONSECUTIVE = Number(import.meta.env.VITE_MIN_CONSECUTIVE || 3);
const WINDOW_SIZE = Number(import.meta.env.VITE_WINDOW_SIZE || 5);
const COOLDOWN_MS = Number(import.meta.env.VITE_ALERT_COOLDOWN_MS || 60_000);
const INTERVAL_MS = Number(import.meta.env.VITE_DETECTION_INTERVAL_MS || 500);

export function useFireSmokeDetection({ videoRef, cameraId, enabled }) {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [lastPrediction, setLastPrediction] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const frameBufferRef = useRef([]);
  const detectionHistoryRef = useRef([]);
  const lastAlertAtRef = useRef(0);
  const timerRef = useRef(null);
  const internalEnabledRef = useRef(enabled);

  useEffect(() => {
    internalEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const modelUrl = import.meta.env.VITE_TFJS_MODEL_URL || '/models/fire_smoke_tfjs/model.json';
        await getModel(modelUrl);
        if (!cancelled) {
          setModelLoaded(true);
        }
      } catch (err) {
        console.error('Error loading TF.js model', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modelLoaded || !videoRef.current) return;

    const run = async () => {
      if (!internalEnabledRef.current) {
        setIsRunning(false);
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      setIsRunning(true);

      try {
        const modelUrl = import.meta.env.VITE_TFJS_MODEL_URL || '/models/fire_smoke_tfjs/model.json';
        const model = await getModel(modelUrl);

        const prediction = tf.tidy(() => {
          const frame = tf.browser.fromPixels(video);
          const resized = tf.image.resizeBilinear(frame, [112, 112]);
          const normalized = resized.toFloat().div(255.0);
          const input = normalized.expandDims(0).expandDims(0);
          const outputs = model.predict(input);

          const [fireT, smokeT, binaryT] = Array.isArray(outputs) ? outputs : [outputs];
          const fire = fireT.dataSync()[0];
          const smoke = smokeT.dataSync()[0];
          const binary = binaryT ? binaryT.dataSync()[0] : Math.max(fire, smoke);

          return {
            fireConfidence: fire * 100,
            smokeConfidence: smoke * 100,
            binaryConfidence: binary * 100,
          };
        });

        setLastPrediction(prediction);

        const timestamp = Date.now();
        detectionHistoryRef.current.push({ ...prediction, timestamp });
        if (detectionHistoryRef.current.length > WINDOW_SIZE) {
          detectionHistoryRef.current.shift();
        }

        const fireAbove = prediction.fireConfidence >= FIRE_THRESHOLD;
        const smokeAbove = prediction.smokeConfidence >= SMOKE_THRESHOLD;

        let consecutive = 0;
        for (let i = detectionHistoryRef.current.length - 1; i >= 0 && consecutive < MIN_CONSECUTIVE; i--) {
          const h = detectionHistoryRef.current[i];
          if (h.fireConfidence >= FIRE_THRESHOLD || h.smokeConfidence >= SMOKE_THRESHOLD) {
            consecutive += 1;
          } else {
            break;
          }
        }

        const avgFire =
          detectionHistoryRef.current.reduce((sum, h) => sum + h.fireConfidence, 0) /
          detectionHistoryRef.current.length;
        const avgSmoke =
          detectionHistoryRef.current.reduce((sum, h) => sum + h.smokeConfidence, 0) /
          detectionHistoryRef.current.length;
        const avg = Math.max(avgFire, avgSmoke);

        const enoughConsecutive = consecutive >= MIN_CONSECUTIVE;
        const avgAbove = avg >= FIRE_THRESHOLD;
        const cooldownOver = timestamp - lastAlertAtRef.current >= COOLDOWN_MS;

        const shouldTrigger = (fireAbove || smokeAbove) && enoughConsecutive && avgAbove && cooldownOver;

        if (shouldTrigger && cameraId) {
          lastAlertAtRef.current = timestamp;
          try {
            await api.post('/alerts', {
              cameraId,
              fireConfidence: prediction.fireConfidence,
              smokeConfidence: prediction.smokeConfidence,
              averageConfidence: avg,
            });
          } catch (err) {
            console.error('Failed to create alert from detection', err);
          }
        }
      } catch (err) {
        console.error('Detection loop error', err);
      }
    };

    timerRef.current = setInterval(run, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRunning(false);
    };
  }, [modelLoaded, videoRef]);

  return {
    modelLoaded,
    lastPrediction,
    isRunning,
  };
}

