import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import BackLink from "@/components/back-link";
import { receiveTransferAction, cancelTransferAction } from "../actions";

export default async function TransferDetailPage({
  params,
}: PageProps<"/transfers/[id]">) {
  const { id } = await params;

  const [transfer, employees] = await Promise.all([
    db.transfer.findUnique({
      where: { id },
      include: {
        fromSite: true,
        toSite: true,
        requestedBy: true,
        receivedBy: true,
        lines: { include: { item: true } },
      },
    }),
    db.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!transfer) notFound();

  return (
    <div className="max-w-2xl">
      <BackLink href="/transfers" label="Back to transfers" />
      <h1 className="text-xl font-semibold text-gray-900">
        Transfer: {transfer.fromSite.name} &rarr; {transfer.toSite.name}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Requested {transfer.requestedAt.toLocaleString()}
        {transfer.requestedBy ? ` by ${transfer.requestedBy.name}` : ""}
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {transfer.status.replace("_", " ")}
          </span>
        </div>

        <table className="mt-4 min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th className="py-2 text-left font-medium text-gray-500">Item</th>
              <th className="py-2 text-right font-medium text-gray-500">Qty</th>
              <th className="py-2 text-right font-medium text-gray-500">Unit cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transfer.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2 text-gray-900">{line.item.name}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 text-right tabular-nums text-gray-500">
                  {line.unitCost != null ? `$${line.unitCost.toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {transfer.notes && (
          <p className="mt-4 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Notes:</span> {transfer.notes}
          </p>
        )}

        {transfer.status === "RECEIVED" && (
          <p className="mt-4 text-sm text-emerald-700">
            Received {transfer.receivedAt?.toLocaleString()}
            {transfer.receivedBy ? ` by ${transfer.receivedBy.name}` : ""}. Inventory
            transactions posted for both sites.
          </p>
        )}

        {transfer.status === "CANCELLED" && (
          <p className="mt-4 text-sm text-gray-500">This transfer was cancelled.</p>
        )}

        {(transfer.status === "REQUESTED" || transfer.status === "IN_TRANSIT") && (
          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
            <form action={receiveTransferAction} className="flex items-center gap-2">
              <input type="hidden" name="transferId" value={transfer.id} />
              <select
                name="receivedById"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Received by…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Mark received
              </button>
            </form>
            <form action={cancelTransferAction}>
              <input type="hidden" name="transferId" value={transfer.id} />
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
