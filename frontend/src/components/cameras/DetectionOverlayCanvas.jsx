import { useCallback, useEffect, useRef } from 'react';

const CLASS_COLORS = {
  fire: '#ef4444',
  smoke: '#94a3b8',
  other: '#fbbf24',
};

// No update for this long (worker stalled, stream down): clear the boxes rather than leave them frozen.
const STALE_MS = 3000;

/** Size of the picture inside `media` (an <img> or <video> drawn with object-contain), or null before it loads. */
const mediaSize = (media) => {
  if (!media) return null;
  const width = media.videoWidth || media.naturalWidth;
  const height = media.videoHeight || media.naturalHeight;
  return width && height ? { width, height } : null;
};

/**
 * Draws server-side detections over a live player. Box coordinates are fractions of the camera frame,
 * so they are mapped onto the letterboxed picture (object-contain), not the whole container.
 * `mediaRefs`: refs to the elements showing the stream, first loaded one wins.
 */
const DetectionOverlayCanvas = ({ detections = [], mediaRefs = [], className = '' }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const receivedAtRef = useRef(0);
  const detectionsRef = useRef(detections);
  const mediaRefsRef = useRef(mediaRefs);
  mediaRefsRef.current = mediaRefs;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (Date.now() - receivedAtRef.current > STALE_MS) return;

    // Picture area inside the container; the whole container until the stream reports its size.
    let box = { left: 0, top: 0, width: rect.width, height: rect.height };
    const size = mediaRefsRef.current.map((ref) => mediaSize(ref?.current)).find(Boolean);
    if (size) {
      const scale = Math.min(rect.width / size.width, rect.height / size.height);
      const width = size.width * scale;
      const height = size.height * scale;
      box = { left: (rect.width - width) / 2, top: (rect.height - height) / 2, width, height };
    }

    ctx.font = '500 12px "Inter Variable", Inter, sans-serif';
    detectionsRef.current.forEach((det) => {
      const color = CLASS_COLORS[det.className] || '#22c55e';
      const x = box.left + (det.x || 0) * box.width;
      const y = box.top + (det.y || 0) * box.height;
      const w = (det.w || 0) * box.width;
      const h = (det.h || 0) * box.height;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = `${det.className} ${Number(det.confidence || 0).toFixed(0)}%`;
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - 18), ctx.measureText(label).width + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 4, Math.max(12, y - 5));
    });
  }, []);

  // Each socket update is a new array: draw it, then clear it if nothing newer arrives in time.
  useEffect(() => {
    detectionsRef.current = detections;
    receivedAtRef.current = Date.now();
    draw();
    const timer = setTimeout(draw, STALE_MS + 50);
    return () => clearTimeout(timer);
  }, [detections, draw]);

  // Redraw on resize (medium player <-> full screen) and once the stream reports its frame size.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    const media = mediaRefsRef.current.map((ref) => ref?.current).filter(Boolean);
    media.forEach((el) => {
      el.addEventListener('load', draw);
      el.addEventListener('loadedmetadata', draw);
    });
    return () => {
      observer.disconnect();
      media.forEach((el) => {
        el.removeEventListener('load', draw);
        el.removeEventListener('loadedmetadata', draw);
      });
    };
  }, [draw]);

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />
    </div>
  );
};

export default DetectionOverlayCanvas;
