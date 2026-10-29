import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ErrorComponentProps, HeadContent, Link, Outlet, Scripts, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const TITLE = "Anchor Hub — the reseller system for companies that sell through people";
const DESCRIPTION =
  "Recruit resellers, share your catalogue, take orders, pay commissions and send payouts. For companies in any industry. Pay monthly by M-Pesa or bank.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#e8eae4" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorView,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      {/* Browser extensions (Grammarly etc.) add attributes to <body>; that isn't a real mismatch. */}
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-[10px] !border !border-rule-2 !bg-paper !text-ink !font-sans !shadow-[0_10px_30px_-12px_rgb(0_0_0/0.3)]",
            description: "!text-ink-2",
          },
        }}
      />
    </QueryClientProvider>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="tategaki mx-auto mb-6 font-mincho text-2xl text-ink-3" lang="ja">迷子</p>
        <h1 className="font-mincho text-3xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <Frame title="This stop doesn't exist">
      <p className="mt-2 text-ink-2">The link may be old or mistyped.</p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-[8px] bg-ink px-5 font-bold text-paper">Go to the start</Link>
    </Frame>
  );
}

function ErrorView({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <Frame title="Something stopped working">
      <p className="mt-2 text-ink-2">{error instanceof Error ? error.message : "Unexpected error."}</p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-6 inline-flex h-11 items-center rounded-[8px] bg-ink px-5 font-bold text-paper"
      >
        Try again
      </button>
    </Frame>
  );
}
