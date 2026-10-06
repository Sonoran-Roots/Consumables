"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Scans a barcode (the Package ID on the label) with the device's camera and
// jumps to that item. Handheld scanners need none of this: they type into the
// search box like a keyboard.
export default function ScanButton({ auditId }: { auditId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Loaded on demand: the scanner library is large and most visits never use the camera.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls?.stop();
              setOpen(false);
              router.push(`/inventory-audit/audits/${auditId}?q=${encodeURIComponent(result.getText().trim())}&status=all`);
            }
          }
        );
        stop = () => controls.stop();
        if (cancelled) controls.stop();
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, then try again."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Couldn't start the camera on this device."
        );
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [open, auditId, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        Scan with camera
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <p className="mb-3 text-center text-sm text-white">Point the camera at the barcode on the label</p>
          <video ref={video} className="max-h-[70vh] w-full max-w-md rounded-xl bg-black" muted playsInline />
          {error && <p className="mt-3 max-w-md text-center text-sm text-red-300">{error}</p>}
          <button type="button" onClick={() => setOpen(false)} className="mt-4 rounded-lg border border-white/40 px-5 py-2 text-sm font-medium text-white">
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
