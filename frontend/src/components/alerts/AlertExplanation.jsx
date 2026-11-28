import { useState } from 'react';
import { AlertTriangle, ImageOff, Loader2, ScanSearch } from 'lucide-react';
import Badge from '../ui/Badge';
import { cn } from '../../utils/cn';
import { formatPercent } from '../../utils/format';
import useAuthedAsset from '../../hooks/useAuthedAsset';
import { cameraName } from './alertUtils';

// Below this share of heatmap attention inside a box, the model was mostly looking elsewhere.
export const LOW_FOCUS = 0.5;
// A heatmap still pending after this long is treated as unavailable (explainer not running).
const PENDING_STALE_MS = 3 * 60 * 1000;
const RISK_TONE = { low: 'success', medium: 'warning', high: 'critical' };
const CLASS_LABEL = { fire: 'Fire', smoke: 'Smoke', other: 'Other' };

const visualState = (alert) => {
  const visual = alert.explanation?.visual;
  if (!visual?.status) return null;
  if (visual.status === 'ready' && visual.heatmapURL) return 'ready';
  if (visual.status === 'pending' || visual.status === 'processing') {
    return Date.now() - new Date(alert.timestamp).getTime() > PENDING_STALE_MS ? 'unavailable' : 'pending';
  }
  return 'unavailable';
};

/** Snapshot with an Original / Model focus toggle once the LayerCAM heatmap is ready. */
export const AlertSnapshot = ({ alert }) => {
  const [view, setView] = useState('original');
  const snapshotPath = alert.frameSnapshotURL || alert.alertImage;
  const snapshot = useAuthedAsset(snapshotPath);
  const state = visualState(alert);
  const heatmap = useAuthedAsset(state === 'ready' ? alert.explanation.visual.heatmapURL : null);
  const showHeatmap = view === 'focus' && heatmap;
  const imageSrc = showHeatmap ? heatmap : snapshot;

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface-2">
      {snapshotPath ? (
        <div className="relative">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={
                showHeatmap
                  ? `Heatmap of where the model looked in the frame from ${cameraName(alert)}`
                  : `Frame captured from ${cameraName(alert)} when the alert was raised`
              }
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="aspect-video w-full animate-pulse bg-surface-3" aria-label="Loading snapshot" role="img" />
          )}
          {heatmap && (
            <div className="absolute right-2 top-2 flex rounded-md bg-black/60 p-0.5 text-xs font-medium backdrop-blur" role="group" aria-label="Snapshot view">
              {[
                ['original', 'Original'],
                ['focus', 'Model focus'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn('rounded px-2 py-1 transition-colors', view === value ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-fg-subtle">
          <ImageOff size={22} aria-hidden="true" />
          <span className="text-xs">No snapshot was captured for this alert</span>
        </div>
      )}
      {showHeatmap && (
        <figcaption className="border-t border-line px-3 py-2 text-xs text-fg-muted">
          Warmer areas influenced the fire/smoke score more. White boxes are the detections.
        </figcaption>
      )}
      {state === 'pending' && (
        <figcaption className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs text-fg-muted">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          Generating the model focus heatmap…
        </figcaption>
      )}
    </figure>
  );
};

const ScoreBreakdown = ({ scores }) => (
  <span className="tabular text-xs text-fg-muted">
    {['fire', 'smoke', 'other']
      .filter((name) => scores?.[name] !== undefined)
      .map((name) => `${CLASS_LABEL[name]} ${formatPercent(scores[name])}`)
      .join(' · ')}
  </span>
);

/** "Why this alert": decision trace, per-box evidence, model focus and the advisory false-alarm likelihood. */
const AlertExplanation = ({ alert }) => {
  const explanation = alert.explanation;
  const reasons = explanation?.reasons || [];
  const frames = explanation?.decision?.frames || [];
  const targets = explanation?.visual?.status === 'ready' ? explanation.visual.targets || [] : [];
  const risk = explanation?.risk?.level ? explanation.risk : null;
  const boxes = (alert.boundingBoxes || []).map((box, index) => ({ ...box, target: targets.find((t) => t.boxIndex === index) }));
  const alertBoxes = boxes.filter((b) => b.className === 'fire' || b.className === 'smoke');

  if (!reasons.length && !alertBoxes.length) return null;
  const startT = frames.length ? new Date(frames[0].t).getTime() : 0;

  return (
    <section aria-labelledby="why-heading" className="space-y-4">
      <h3 id="why-heading" className="eyebrow">
        Why this alert
      </h3>

      {reasons.length > 0 && (
        <ul className="space-y-2">
          {reasons.map((reason) => (
            <li key={reason.code} className="flex gap-2 text-sm text-fg">
              {reason.code === 'lookalike' ? (
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-subtle" aria-hidden="true" />
              )}
              <span>{reason.text}</span>
            </li>
          ))}
        </ul>
      )}

      {alertBoxes.length > 0 && (
        <div className="rounded-lg border border-line">
          <p className="border-b border-line px-3 py-2 text-xs font-medium text-fg-muted">Detected regions</p>
          <ul className="divide-y divide-line">
            {alertBoxes.map((box, i) => {
              const focus = box.target?.focusInBox;
              const lowFocus = focus !== undefined && focus < LOW_FOCUS;
              return (
                <li key={i} className="space-y-1 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">
                      {CLASS_LABEL[box.className] || box.className} {formatPercent(box.confidence)}
                    </span>
                    {focus !== undefined && (
                      <Badge tone={lowFocus ? 'warning' : 'neutral'} size="xs">
                        <ScanSearch size={11} aria-hidden="true" />
                        Model focus in box {formatPercent(focus * 100)}
                      </Badge>
                    )}
                  </div>
                  {box.scores && <ScoreBreakdown scores={box.scores} />}
                  {lowFocus && (
                    <p className="text-xs text-warning-fg">
                      Most of the model’s attention is outside this region. Check the snapshot for reflections or lighting.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {frames.length > 0 && (
        <details className="group rounded-lg border border-line">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fg-muted hover:text-fg">
            Confirming frames ({frames.length})
          </summary>
          <table className="w-full border-t border-line text-left text-xs">
            <thead className="text-fg-subtle">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Time</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Fire</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Smoke</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Area</th>
              </tr>
            </thead>
            <tbody className="tabular text-fg">
              {frames.map((f, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">+{((new Date(f.t).getTime() - startT) / 1000).toFixed(1)} s</td>
                  <td className="px-3 py-1.5">{formatPercent(f.fire)}</td>
                  <td className="px-3 py-1.5">{formatPercent(f.smoke)}</td>
                  <td className="px-3 py-1.5">{formatPercent((f.area || 0) * 100, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {risk && (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">False-alarm likelihood</span>
            <Badge tone={RISK_TONE[risk.level] || 'neutral'}>
              {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} · {formatPercent(risk.probability * 100)}
            </Badge>
          </div>
          {risk.contributions?.length > 0 && (
            <ul className="space-y-1 text-xs text-fg-muted">
              {risk.contributions.map((c) => (
                <li key={c.feature} className="flex justify-between gap-3">
                  <span>{c.label}</span>
                  <span className={cn('tabular shrink-0 font-medium', c.impact > 0 ? 'text-warning-fg' : 'text-success-fg')}>
                    {c.impact > 0 ? '+' : '−'}
                    {formatPercent(Math.abs(c.impact) * 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-2xs text-fg-subtle">Advisory only, learned from past operator outcomes. Always verify on camera.</p>
        </div>
      )}
    </section>
  );
};

export default AlertExplanation;
