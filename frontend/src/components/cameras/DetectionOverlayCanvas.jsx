import { useEffect, useRef } from 'react';

const CLASS_COLORS = {
  fire: '#ef4444',
  smoke: '#94a3b8',
  other: '#fbbf24',
};

const DetectionOverlayCanvas = ({ detections = [], className = '' }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
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

    detections.forEach((det) => {
      const color = CLASS_COLORS[det.className] || '#22c55e';
      const x = (det.x || 0) * rect.width;
      const y = (det.y || 0) * rect.height;
      const w = (det.w || 0) * rect.width;
      const h = (det.h || 0) * rect.height;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = `${det.className} ${Number(det.confidence || 0).toFixed(0)}%`;
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - 18), ctx.measureText(label).width + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.fillText(label, x + 4, Math.max(12, y - 5));
    });
  }, [detections]);

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />
    </div>
  );
};

export default DetectionOverlayCanvas;
