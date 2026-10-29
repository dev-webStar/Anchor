import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { amount } from "@/lib/format";

export function CopyButton({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          toast.error("Couldn't copy. Select the text and copy it by hand.");
        }
      }}
      className={cn("grid shrink-0 place-items-center rounded-[8px] border border-rule-2 bg-paper text-ink-2 hover:border-ink-3 hover:text-ink", small ? "size-8" : "size-12")}
    >
      {done ? <Check className={cn(small ? "size-3.5" : "size-5", "text-wakatake")} /> : <Copy className={small ? "size-3.5" : "size-5"} />}
    </button>
  );
}

/** The seller's earnings, drawn as a prepaid transit card. */
export function EarningsCard({ available, currency, holder, company, note, className }: { available: number; currency: string; holder: string; company: string; note?: string; className?: string }) {
  return (
    <div className={cn("seigaiha relative aspect-[1.586] w-full max-w-[400px] overflow-hidden rounded-[18px] bg-ai text-paper shadow-[0_18px_40px_-18px_rgb(30_53_87/0.65)]", className)}>
      <div className="absolute inset-x-0 top-[30%] h-[9px] bg-yamabuki" />
      <div className="absolute inset-x-0 top-[calc(30%+9px)] h-[3px] bg-shu" />
      <div className="relative flex h-full flex-col justify-between p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate font-mincho text-[17px] leading-tight font-extrabold">{company}</p>
          <span className="shrink-0 text-[11px] tracking-[0.2em] text-paper/70" lang="ja">報酬</span>
        </div>
        <div>
          <p className="text-[13px] text-paper/70">Ready to pay out</p>
          <p className="num flex items-baseline gap-1.5 leading-none">
            <span className="text-lg font-bold text-paper/80">{currency}</span>
            <span className="text-[42px] font-black tracking-[-0.03em] md:text-[48px]">{amount(available)}</span>
          </p>
          <p className="mt-3 truncate text-[13px] text-paper/70">
            {holder}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export function useOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}
