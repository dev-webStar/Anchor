import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getViewer } from "@/lib/api/auth.functions";

export function useViewer() {
  const fn = useServerFn(getViewer);
  return useQuery({ queryKey: ["viewer"], queryFn: () => fn(), staleTime: 30_000 });
}
export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

export function useActive() {
  const v = useViewer();
  const a = v.data?.active ?? null;
  const role = a?.member.role ?? null;
  return {
    viewer: v.data ?? null,
    org: a?.org ?? null,
    member: a?.member ?? null,
    access: a?.access ?? null,
    role,
    isManager: role === "owner" || role === "manager",
    isOwner: role === "owner",
    currency: a?.org.currency ?? "KES",
  };
}
