"use client";

/**
 * Scan a machine: the phone's camera reads the QR label on a machine and opens its page. Where the browser cannot read QR codes
 * (or the camera is not allowed), the person types the fleet number painted on the machine instead. Nothing is recorded: the
 * camera picture stays on the phone and is never saved.
 */
import { ArrowLeft, Camera, CameraOff, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useShellData } from "@core/components/shell-data";
import { machineFromCode } from "@core/lib/machine-codes";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

export function ScanScreen() {
  const router = useRouter();
  const { data } = useShellData();
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unsupported" | "denied">("starting");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const machines = data?.equipment ?? [];
  const machinesRef = useRef(machines);
  useEffect(() => { machinesRef.current = machines; });

  useEffect(() => {
    const Barcode = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (!Barcode || !navigator.mediaDevices?.getUserMedia) {
      const timer = window.setTimeout(() => setCamera("unsupported"), 0);
      return () => window.clearTimeout(timer);
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const detector = new Barcode({ formats: ["qr_code"] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (media) => {
        if (stopped) { media.getTracks().forEach((track) => track.stop()); return; }
        stream = media;
        if (video.current) { video.current.srcObject = media; await video.current.play().catch(() => undefined); }
        setCamera("on");
        const look = async () => {
          if (stopped || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            const machine = found.map((item) => machineFromCode(item.rawValue, machinesRef.current)).find(Boolean);
            if (machine) { router.push(`/machines/${machine.id}`); return; }
            if (found.length) setMessage("That code is not a VESPER machine label.");
          } catch {
            // A frame that cannot be read; try the next one.
          }
          timer = window.setTimeout(look, 300);
        };
        void look();
      })
      .catch(() => setCamera("denied"));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [router]);

  const open = (event: React.FormEvent) => {
    event.preventDefault();
    const machine = machineFromCode(code, machines);
    if (machine) router.push(`/machines/${machine.id}`);
    else setMessage(`No machine matches "${code.trim()}". Check the fleet number on the machine, for example EX-204.`);
  };

  return (
    <div className="mobile-task-page scan">
      <Link href="/my-shift" className="back-link"><ArrowLeft /> My Shift</Link>
      <div className="mobile-page-header">
        <span className="eyebrow">Find a machine</span>
        <h1>Scan a machine</h1>
        <p>Point the camera at the QR label on the machine, or type its fleet number.</p>
      </div>

      <div className={`scan__viewer scan__viewer--${camera}`}>
        <video ref={video} muted playsInline aria-label="Camera view" />
        {camera === "on" ? <span className="scan__frame" aria-hidden="true" /> : null}
        {camera !== "on" ? (
          <div className="scan__state" role="status">
            {camera === "starting" ? <><Camera aria-hidden="true" /><span>Starting the camera…</span></> : null}
            {camera === "unsupported" ? <><CameraOff aria-hidden="true" /><span>This browser cannot read QR codes. Type the fleet number below, or open the label with the phone&apos;s camera app.</span></> : null}
            {camera === "denied" ? <><CameraOff aria-hidden="true" /><span>The camera is not allowed for VESPER. Allow it in the phone&apos;s settings, or type the fleet number below.</span></> : null}
          </div>
        ) : null}
      </div>

      <form className="scan__manual" onSubmit={open}>
        <label className="form-field">
          <span>Fleet number</span>
          <input value={code} onChange={(event) => { setCode(event.target.value); setMessage(null); }} placeholder="For example EX-204" autoCapitalize="characters" autoComplete="off" />
        </label>
        <button type="submit" className="button button--primary" disabled={!code.trim()}><Search aria-hidden="true" /> Open</button>
      </form>
      {message ? <p className="field-error" role="alert">{message}</p> : null}
    </div>
  );
}
