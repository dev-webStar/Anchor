import { cn } from "@/lib/cn";

/*
  Anchor Hub logo.
  The mark is an anchor drawn like a transit map inside a red seal:
  the ring is a station, the shank is a line, and the two flukes end in
  yellow stations — a hub with lines running out to its sellers.
*/

export function AnchorMark({ size = 40, className, title = "Anchor Hub" }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <rect width="48" height="48" rx="9" fill="#d23f27" />
      <rect x="3.5" y="3.5" width="41" height="41" rx="6.5" fill="none" stroke="#fbfbf8" strokeOpacity=".4" strokeWidth="1.2" />
      <g fill="none" stroke="#fbfbf8" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 16.5V38.5" />
        <path d="M16.5 21.5H31.5" />
        <path d="M11.5 29.5c1.2 6.4 6.1 9.6 12.5 9.6s11.3-3.2 12.5-9.6" />
      </g>
      <circle cx="24" cy="11.6" r="4.3" fill="#d23f27" stroke="#fbfbf8" strokeWidth="3.2" />
      <circle cx="11.5" cy="29.5" r="3.3" fill="#f2b300" stroke="#fbfbf8" strokeWidth="1.8" />
      <circle cx="36.5" cy="29.5" r="3.3" fill="#f2b300" stroke="#fbfbf8" strokeWidth="1.8" />
    </svg>
  );
}

/** The wordmark: "Anchor" set in mincho, "Hub" as an ink station sign. */
export function Wordmark({ className, size = 20, tagline = true }: { className?: string; size?: number; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)} style={{ fontSize: size }}>
      <span className="inline-flex items-baseline gap-[0.28em]">
        <span className="font-mincho font-extrabold tracking-[-0.01em]">Anchor</span>
        <span className="relative inline-flex items-center rounded-[0.22em] bg-ink px-[0.32em] py-[0.12em] font-sans text-[0.62em] font-black tracking-[0.04em] text-paper">
          Hub
          <span className="absolute -right-[0.18em] -bottom-[0.18em] size-[0.42em] rounded-full border-[0.1em] border-stone bg-yamabuki" />
        </span>
      </span>
      {tagline && <span className="mt-[0.3em] font-sans text-[0.5em] font-bold text-ink-2">Reseller system</span>}
    </span>
  );
}

export function Logo({ size = 36, tagline = true, className }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <AnchorMark size={size} />
      <Wordmark size={Math.round(size * 0.56)} tagline={tagline} />
    </span>
  );
}
