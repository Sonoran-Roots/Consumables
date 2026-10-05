"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markFindingsEmailed } from "./actions";

const btn = "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const primary = "rounded-md border border-black bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-white hover:text-black disabled:opacity-50";

// Plenty of mail clients cut off or refuse very long mailto: links, so only
// offer one when the whole message comfortably fits.
const MAILTO_LIMIT = 1800;

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure pages: fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export default function EmailCard({
  recipientName, email, subject, body, findingIds, openCount, mode,
}: {
  recipientName: string;
  email: string;
  subject: string;
  body: string;
  findingIds: string[];
  openCount: number; // how many of these are still Open (would move to Notified)
  mode: "notice" | "reminder";
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function doCopy(label: string, text: string) {
    const ok = await copy(text);
    setCopied(ok ? label : null);
    setMessage(ok ? null : "Couldn't copy — select the text below and copy it by hand.");
    if (ok) setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
  }

  async function markSent() {
    setBusy(true);
    setMessage(null);
    const r = await markFindingsEmailed(findingIds, `${recipientName} <${email}>`, mode);
    setBusy(false);
    if (!r.ok) return setMessage(r.error);
    setMessage(`Done — ${r.notified} finding${r.notified === 1 ? "" : "s"} marked notified.`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{recipientName}</p>
          <p className="text-xs text-gray-500">{email} · {findingIds.length} finding{findingIds.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => doCopy("subject", subject)}>{copied === "subject" ? "Copied" : "Copy subject"}</button>
          <button type="button" className={primary} onClick={() => doCopy("body", body)}>{copied === "body" ? "Copied" : "Copy email"}</button>
          {mailto.length <= MAILTO_LIMIT && <a href={mailto} className={btn}>Open in email app</a>}
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">Preview</summary>
        <p className="mt-2 text-xs text-gray-500">Subject: <span className="text-gray-800">{subject}</span></p>
        <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">{body}</pre>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
        <button type="button" disabled={busy} className={btn} onClick={markSent}>
          {busy ? "Saving…" : mode === "reminder" ? "I sent the reminder" : openCount > 0 ? `I sent it — mark ${openCount} notified` : "I sent it — add a note to each"}
        </button>
        <span className="text-xs text-gray-400">{mode === "reminder" ? "Records the reminder on each finding so it isn't repeated too soon." : "Records that this email went out."} Do it after you&apos;ve sent it.</span>
        {message && <span className="text-xs text-[#134229]">{message}</span>}
      </div>
    </div>
  );
}
