import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Hanko } from "@/components/kit";
import { Logo } from "@/components/logo";

export function AuthFrame({ title, intro, children, aside, brand }: { title: string; intro?: ReactNode; children: ReactNode; aside?: ReactNode; brand?: string }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <p aria-hidden lang="ja" className="tategaki pointer-events-none absolute top-10 right-[4vw] hidden font-mincho text-[min(16vh,150px)] leading-none font-extrabold text-ink/[0.05] select-none lg:block">
        錨を下ろす
      </p>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 py-10">
        <div className="mb-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            {brand ? (
              <>
                <Hanko size={36} name={brand} />
                <span className="leading-none">
                  <span className="block font-mincho text-[17px] font-extrabold">{brand}</span>
                  <span className="block text-[11px] font-bold text-ink-2">on Anchor Hub</span>
                </span>
              </>
            ) : (
              <Logo size={36} />
            )}
          </Link>
          {aside}
        </div>
        <h1 className="font-mincho text-[34px] leading-[1.15] font-extrabold tracking-[-0.01em]">{title}</h1>
        {intro && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-[8px] border border-shu/25 bg-shu-soft/60 px-3 py-2.5 text-sm text-ink">{error}</p>;
}
