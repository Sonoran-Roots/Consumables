"use client";

import { useState } from "react";

export default function ParLevelCalculator({
  avgDailyUsage,
  currentOnHand,
  daysOfHistory,
}: {
  avgDailyUsage: number;
  currentOnHand: number;
  daysOfHistory: number;
}) {
  const [coverageDays, setCoverageDays] = useState(30);

  const suggestedPar = Math.ceil(avgDailyUsage * coverageDays);
  const suggestedReorder = Math.max(suggestedPar - currentOnHand, 0);

  const lowConfidence = daysOfHistory < 14 || avgDailyUsage === 0;

  return (
    <div className="mt-5 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">
          Coverage
          <input
            type="number"
            min={1}
            value={coverageDays}
            onChange={(e) => setCoverageDays(Math.max(1, Number(e.target.value) || 1))}
            className="mx-2 w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          days of stock
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-gray-500">Suggested par level</div>
          <div className="text-xl font-semibold text-gray-900">{suggestedPar}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Current on hand</div>
          <div className="text-xl font-semibold text-gray-900">{currentOnHand}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Suggested reorder qty</div>
          <div
            className={`text-xl font-semibold ${
              suggestedReorder > 0 ? "text-amber-700" : "text-gray-900"
            }`}
          >
            {suggestedReorder}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Par level = avg daily usage × coverage days. Reorder qty = par level −
        current on hand.
      </p>

      {lowConfidence && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {avgDailyUsage === 0
            ? "No usage recorded at this site yet — this can't be calculated reliably until real sales/checkout activity accumulates."
            : `Only ${daysOfHistory} day(s) of usage history — treat this as a rough placeholder until more data comes in.`}
        </p>
      )}
    </div>
  );
}
