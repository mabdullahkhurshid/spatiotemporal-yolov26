import { Flame, Hand, MoreHorizontal } from 'lucide-react';

/**
 * A faithful, static slice of the product: live view with a detection box beside the alert it produced.
 * Decorative for screen readers (the hero copy carries the message).
 */
const ProductPreview = () => (
  <div aria-hidden="true" className="relative select-none">
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0E1522] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
      {/* window bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-white/80">Loading Dock A</span>
          <span className="rounded bg-white/10 px-1.5 py-px font-mono text-[10px] text-white/60">CAM-01</span>
        </div>
        <span className="text-[11px] text-white/45">Live · 2 fps analysis</span>
      </div>

      {/* camera frame */}
      <div className="relative aspect-[16/9] bg-[#0A0F18]">
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
        {/* scene silhouette: racks + floor line */}
        <div className="absolute inset-x-0 bottom-[22%] h-px bg-white/10" />
        <div className="absolute bottom-[22%] left-[8%] h-[46%] w-[14%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        <div className="absolute bottom-[22%] left-[26%] h-[38%] w-[12%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        <div className="absolute bottom-[22%] right-[10%] h-[52%] w-[18%] rounded-t-sm border border-white/10 bg-white/[0.03]" />
        {/* heat glow where the detection is */}
        <div className="absolute bottom-[22%] left-[46%] h-[34%] w-[22%] rounded-full bg-[radial-gradient(ellipse_at_bottom,rgb(249_115_22/0.55),rgb(217_45_32/0.25)_45%,transparent_70%)] blur-[2px]" />
        {/* smoke drift */}
        <div className="absolute bottom-[46%] left-[44%] h-[30%] w-[30%] rounded-full bg-[radial-gradient(ellipse,rgb(148_163_184/0.22),transparent_65%)]" />

        {/* detection boxes, as the overlay canvas draws them */}
        <div className="absolute bottom-[22%] left-[47%] h-[30%] w-[19%] rounded-sm border-2 border-[#EF4444]">
          <span className="absolute -top-5 left-[-2px] whitespace-nowrap rounded-sm bg-[#DC2626] px-1.5 py-px text-[10px] font-semibold text-white">fire 92%</span>
        </div>
        <div className="absolute bottom-[48%] left-[43%] h-[26%] w-[29%] rounded-sm border-2 border-[#94A3B8]">
          <span className="absolute -top-5 right-[-2px] whitespace-nowrap rounded-sm bg-[#94A3B8] px-1.5 py-px text-[10px] font-semibold text-[#0B1220]">smoke 71%</span>
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#D92D20] px-2.5 py-1 text-[11px] font-semibold text-white">
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
            <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
            <p className="tabular mt-0.5 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </div>

    {/* the alert it raised */}
    <div className="absolute -bottom-10 -left-6 w-[17rem] rounded-lg border border-line bg-surface p-3.5 text-left shadow-overlay sm:-left-10 sm:w-[19rem]">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse-ring rounded-full bg-critical" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-fg">Loading Dock A</p>
            <span className="rounded-full bg-critical-soft px-1.5 py-px text-[10px] font-medium text-critical-fg ring-1 ring-inset ring-critical-line">High</span>
          </div>
          <p className="mt-0.5 text-xs text-fg-muted">Warehouse · Fire 92% · Smoke 71%</p>
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
