import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JARS Cannabis Arizona | Inventory Audit",
  description: "Inventory audit findings, follow-up and resolution",
};

export default function InventoryAuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
