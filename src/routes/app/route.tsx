import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getViewer } from "@/lib/api/auth.functions";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const viewer = await context.queryClient.fetchQuery({ queryKey: ["viewer"], queryFn: () => getViewer(), staleTime: 30_000 });
    if (!viewer) throw redirect({ to: "/login", search: { next: location.href } as never });
    if (!viewer.active) throw redirect({ to: viewer.user.is_platform_admin ? "/platform" : "/signup" });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
