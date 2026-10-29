import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------- Seal ---------- */

/** The red seal. Defaults to 錨 (ikari, "anchor"); pass a name to stamp its first letter. */
export function Hanko({ name, size = 40, className }: { name?: string; size?: number; className?: string }) {
  const ch = name ? (name.trim()[0] ?? "A").toUpperCase() : "錨";
  return (
    <span
      aria-hidden
      className={cn("relative inline-grid shrink-0 place-items-center rounded-[5px] bg-shu text-paper font-mincho font-extrabold", className)}
      style={{ width: size, height: size, fontSize: size * 0.56, lineHeight: 1 }}
    >
      <span className="absolute inset-[3px] rounded-[3px] border border-paper/45" />
      {ch}
    </span>
  );
}

/* ---------- Buttons ---------- */

type Variant = "ink" | "yamabuki" | "outline" | "ghost" | "danger" | "ai";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  ink: "bg-ink text-paper hover:bg-ink/88 active:translate-y-px",
  yamabuki: "bg-yamabuki text-ink hover:brightness-[1.04] shadow-[0_2px_0_#c58f00] active:translate-y-[2px] active:shadow-none",
  ai: "bg-ai text-paper hover:bg-ai-2 active:translate-y-px",
  outline: "border border-rule-2 bg-paper text-ink hover:border-ink-3 active:translate-y-px",
  ghost: "text-ink-2 hover:text-ink hover:bg-stone-2/60",
  danger: "border border-shu/30 bg-paper text-shu hover:bg-shu-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-[7px]",
  md: "h-11 px-4 text-[15px] gap-2 rounded-[8px]",
  lg: "h-13 px-6 text-base gap-2 rounded-[10px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ink", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-bold whitespace-nowrap transition-[background,transform,box-shadow,border-color] disabled:opacity-45 disabled:shadow-none disabled:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ---------- Form fields ---------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full rounded-[8px] border border-rule-2 bg-paper px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors",
          "focus:border-ai focus:ring-2 focus:ring-ai/15 disabled:bg-stone-2/50 disabled:text-ink-2",
          invalid && "border-shu focus:border-shu focus:ring-shu/15",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-[8px] border border-rule-2 bg-paper px-3 py-2.5 text-[15px] leading-relaxed placeholder:text-ink-3 outline-none focus:border-ai focus:ring-2 focus:ring-ai/15",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-[8px] border border-rule-2 bg-paper bg-[length:12px] bg-[right_12px_center] bg-no-repeat pl-3 pr-8 text-[15px] outline-none focus:border-ai focus:ring-2 focus:ring-ai/15",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23565b62' stroke-width='1.6' fill='none'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[13px] text-shu">{error}</p> : hint ? <p className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-ink-2 hover:text-ink"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/* ---------- Switch ---------- */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className="relative h-7 w-12 shrink-0 rounded-full border border-rule-2 bg-stone-2 transition-colors data-[state=checked]:border-wakatake data-[state=checked]:bg-wakatake disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-[3px] rounded-full bg-paper shadow-sm transition-transform data-[state=checked]:translate-x-[23px]" />
    </SwitchPrimitive.Root>
  );
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-[9px] border border-rule-2 bg-stone-2/60 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-[6px] px-3.5 text-sm font-bold whitespace-nowrap transition-colors",
            value === o.value ? "bg-paper text-ink shadow-[0_1px_0_var(--color-rule-2)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Layout ---------- */

export function PageTitle({
  title,
  jp,
  children,
  actions,
}: {
  title: string;
  jp?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 md:mb-9">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mincho text-[28px] leading-tight font-extrabold tracking-[-0.01em] md:text-[34px]">{title}</h1>
          {jp && <span className="text-sm text-ink-3" lang="ja">{jp}</span>}
        </div>
        {children && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[14px] border border-rule bg-paper", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHead({ title, jp, right, className }: { title: string; jp?: string; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <h2 className="flex items-baseline gap-2.5 text-lg font-bold">
        {title}
        {jp && <span className="text-xs font-medium text-ink-3" lang="ja">{jp}</span>}
      </h2>
      {right}
    </div>
  );
}

/* ---------- Status ---------- */

const lamp: Record<string, { color: string; label: string; blink?: boolean }> = {
  new: { color: "bg-yamabuki", label: "New" },
  confirmed: { color: "bg-ai", label: "Confirmed", blink: true },
  fulfilled: { color: "bg-wakatake", label: "Fulfilled" },
  cancelled: { color: "bg-ink-3", label: "Cancelled" },
  requested: { color: "bg-yamabuki", label: "Requested" },
  paid: { color: "bg-wakatake", label: "Paid" },
  rejected: { color: "bg-shu", label: "Rejected" },
  pending: { color: "bg-yamabuki", label: "Waiting" },
  active: { color: "bg-wakatake", label: "Active" },
  suspended: { color: "bg-shu", label: "On hold" },
  trialing: { color: "bg-ai", label: "Free trial" },
  past_due: { color: "bg-shu", label: "Payment due" },
  confirmed_payment: { color: "bg-wakatake", label: "Confirmed" },
  failed: { color: "bg-shu", label: "Failed" },
};

export function Status({ status, className }: { status: string; className?: string }) {
  const s = lamp[status] ?? { color: "bg-ink-3", label: status };
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-bold text-ink whitespace-nowrap", className)}>
      <span className={cn("size-2 rounded-[2px]", s.color, s.blink && "animate-lamp")} />
      {s.label}
    </span>
  );
}

/** Line lamp — is a product line accepting orders? */
export function LineLamp({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-bold">
      <span className={cn("size-2.5 rounded-full", online ? "bg-wakatake shadow-[0_0_0_3px_var(--color-wakatake-soft)]" : "bg-shu")} />
      {online ? "Selling now" : "Paused"}
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 h-10 w-px bg-rule-2" />
      <p className="font-mincho text-xl font-bold">{title}</p>
      {children && <p className="mt-1.5 max-w-[44ch] text-[15px] text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-ink-3", className)} />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-ink-2">
      <Spinner /> {label}
    </div>
  );
}

/* ---------- Dialog / sheet ---------- */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "center",
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  side?: "center" | "right";
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex max-h-[100dvh] flex-col bg-stone outline-none",
            side === "center" &&
              "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[18px] md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[18px]",
            side === "center" && (wide ? "md:max-w-2xl" : "md:max-w-md"),
            side === "right" && "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[18px] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-[18px]",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-5 pt-5 pb-4">
            <div>
              <DialogPrimitive.Title className="font-mincho text-[22px] font-extrabold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-ink-2">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="-mr-1 grid size-9 place-items-center rounded-full text-ink-2 hover:bg-stone-2 hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------- Table helpers ---------- */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-rule-2 px-4 py-3 text-left text-[13px] font-bold whitespace-nowrap text-ink-2", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-rule px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: "ai" | "yamabuki" | "shu" | "wakatake" }) {
  const bar = { ai: "bg-ai", yamabuki: "bg-yamabuki", shu: "bg-shu", wakatake: "bg-wakatake" }[tone ?? "ai"];
  return (
    <div className="relative pl-4">
      <span className={cn("absolute inset-y-1 left-0 w-[3px] rounded-full", bar)} />
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="num mt-0.5 text-[26px] font-bold leading-tight">{value}</p>
      {note && <p className="mt-0.5 text-[13px] text-ink-3">{note}</p>}
    </div>
  );
}
