"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBundles } from "./actions";

/** Pulls the bundle number out of a scanned label, which holds the bundle's page address. */
function bundleFromScan(text: string): string | null {
  const match = text.match(/\/admin\/quality\/([A-Za-z0-9-]+)\s*$/) ?? text.trim().match(/^([A-Za-z]+-\d+-\d+)$/);
  return match ? match[1]!.toUpperCase() : null;
}

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

export function ScanBundle() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    (async () => {
      const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser cannot scan here. Open your phone camera and point it at the label, or type the bundle number.");
        setScanning(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setMessage("Camera access was not allowed. Type the bundle number instead.");
        setScanning(false);
        return;
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new Ctor({ formats: ["qr_code"] });
      timer = setInterval(async () => {
        if (!videoRef.current) return;
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const bundle = codes.map((c) => bundleFromScan(c.rawValue)).find(Boolean);
        if (bundle) {
          setScanning(false);
          router.push(`/admin/quality/${bundle}`);
        }
      }, 400);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, router]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" className="btn-shine" onClick={() => { setMessage(""); setScanning((s) => !s); }}>
          {scanning ? "Stop camera" : "Scan QR code"}
        </Button>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const bundle = bundleFromScan(manual);
            if (bundle) router.push(`/admin/quality/${bundle}`);
            else setMessage("Bundle numbers look like B-2003-001.");
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            or type the bundle number
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="B-2003-001" className="w-44" />
          </label>
          <Button type="submit" variant="outline">Open</Button>
        </form>
      </div>
      {scanning && (
        <video ref={videoRef} muted playsInline className="rise aspect-video w-full max-w-md rounded-xl border bg-black object-cover" />
      )}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

export function CreateBundles({ batches }: { batches: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const batchId = String(f.get("batch") ?? "");
        startTransition(async () => {
          const result = await createBundles(batchId, Number(f.get("count")));
          if (result.ok) {
            toast.success(result.message ?? "Created");
            router.push(`/admin/quality/labels/${batchId}`);
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="batch" className="text-xs text-muted-foreground">Batch</Label>
        <NativeSelect id="batch" name="batch" required defaultValue="" className="min-w-64">
          <option value="" disabled>Select a batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="count" className="text-xs text-muted-foreground">New bundles</Label>
        <Input id="count" name="count" type="number" min={1} max={50} defaultValue={1} required className="w-24" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? "Creating…" : "Create QR labels"}</Button>
    </form>
  );
}

export function PrintButton() {
  return (
    <Button type="button" className="print:hidden" onClick={() => window.print()}>
      Print labels
    </Button>
  );
}
