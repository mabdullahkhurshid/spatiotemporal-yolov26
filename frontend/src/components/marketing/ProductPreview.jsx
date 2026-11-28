import { Flame, Hand, MoreHorizontal } from 'lucide-react';

/**
 * A faithful, static slice of the product: live view with a detection box above the alert it produced.
 * Decorative for screen readers (the hero copy carries the message).
 */
const ProductPreview = () => (
  <div aria-hidden="true" className="relative select-none">
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0E1522] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
      {/* window bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs font-medium text-white/80">Loading Dock A</span>
          <span className="rounded bg-white/10 px-1.5 py-px font-mono text-2xs text-white/60">CAM-01</span>
        </div>
        <span className="text-2xs text-white/50">Live · 2 fps analysis</span>
      </div>

      {/* camera frame */}
      <div className="relative aspect-[16/9] bg-[#0A0F18]">
        {/* scene silhouette: racks + floor line */}
        <div className="absolute inset-x-0 bottom-[22%] h-px bg-white/10" />
        <div className="absolute bottom-[22%] left-[8%] h-[46%] w-[14%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        <div className="absolute bottom-[22%] left-[26%] h-[38%] w-[12%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        <div className="absolute bottom-[22%] right-[10%] h-[52%] w-[18%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        {/* the fire itself: warm light on the floor, smoke drifting above */}
        <div className="absolute bottom-[22%] left-[46%] h-[34%] w-[22%] rounded-full bg-[radial-gradient(ellipse_at_bottom,rgb(249_115_22/0.55),rgb(217_45_32/0.25)_45%,transparent_70%)] blur-[2px]" />
        <div className="absolute bottom-[46%] left-[44%] h-[30%] w-[30%] rounded-full bg-[radial-gradient(ellipse,rgb(148_163_184/0.22),transparent_65%)]" />

        {/* detection boxes, as the overlay canvas draws them */}
        <div className="absolute bottom-[22%] left-[47%] h-[30%] w-[19%] rounded-sm border-2 border-[#EF4444]">
          <span className="tabular absolute -top-5 left-[-2px] whitespace-nowrap rounded-sm bg-[#DC2626] px-1.5 py-px text-2xs font-medium text-white">fire 92%</span>
        </div>
        <div className="absolute bottom-[48%] left-[43%] h-[26%] w-[29%] rounded-sm border-2 border-[#94A3B8]">
          <span className="tabular absolute -top-5 right-[-2px] whitespace-nowrap rounded-sm bg-[#94A3B8] px-1.5 py-px text-2xs font-medium text-[#0B1220]">smoke 71%</span>
        </div>

        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-[#D92D20] px-2 py-1 text-2xs font-medium text-white">
          <Flame size={12} />
          Detecting
        </div>
      </div>

      {/* telemetry */}
      <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 text-white">
        {[
          ['Fire', '92%'],
          ['Smoke', '71%'],
          ['Confirmed', '3 frames'],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-2xs text-white/50">{label}</p>
            <p className="tabular mt-0.5 text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>

    {/* the alert it raised, hanging just below the window so the readings stay visible */}
    <div className="absolute left-4 top-[calc(100%-1rem)] w-[17rem] rounded-lg border border-line bg-surface p-3.5 text-left shadow-overlay sm:left-8 sm:w-[19rem]">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse-ring rounded-full bg-critical" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-fg">Loading Dock A</p>
            <span className="rounded bg-critical-soft px-1.5 py-px text-2xs font-medium text-critical-fg ring-1 ring-inset ring-critical-line">High</span>
          </div>
          <p className="tabular mt-0.5 text-xs text-fg-muted">Warehouse · Fire 92% · Smoke 71%</p>
          <p className="text-xs text-fg-subtle">Detected just now</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-600 text-xs font-medium text-white">
          <Hand size={14} />
          Acknowledge
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted">
          <MoreHorizontal size={16} />
        </span>
      </div>
    </div>
  </div>
);

export default ProductPreview;
