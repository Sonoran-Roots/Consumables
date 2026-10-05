import { redirect } from "next/navigation";

// The importer moved into Setup → Bulk import; keep old bookmarks working.
export default function ImportMovedPage() {
  redirect("/bulk-import/inventory");
}
