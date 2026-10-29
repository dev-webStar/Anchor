import { createFileRoute } from "@tanstack/react-router";
import { useActive } from "@/lib/viewer";
import { CompanyOverview } from "@/components/overview";
import { SellerHome } from "@/components/seller-home";

export const Route = createFileRoute("/app/")({ component: AppHome });

function AppHome() {
  const { isManager } = useActive();
  return isManager ? <CompanyOverview /> : <SellerHome />;
}
