"use client";

/**
 * Evidence for a report from the phone: photos (camera or gallery, compressed on the phone before they are added) and the
 * phone's location, shared only when the person asks. Both are optional, and both travel with the report (or wait with it in the
 * outbox when offline).
 */
import { Camera, LocateFixed, MapPin, X } from "lucide-react";
import { useId, useState } from "react";
import type { IssuePhoto, ReportedLocation } from "@vesper/api-contracts";

const MAX_PHOTOS = 4;
const MAX_EDGE = 1024;

const sizeLabel = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Scales a photo down to at most 1024 px on its long edge and saves it as a JPEG, so a report stays small enough to send on site. */
async function compress(file: File): Promise<IssuePhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  return {
    id: `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    kind: "photo",
    sizeLabel: sizeLabel(Math.round((dataUrl.length * 3) / 4)),
    dataUrl,
    takenAt: new Date().toISOString(),
  };
}

export function PhotoPicker({ photos, onChange }: { photos: IssuePhoto[]; onChange: (photos: IssuePhoto[]) => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = [...files].filter((file) => file.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setError(`At most ${MAX_PHOTOS} photos per report.`);
    setBusy(true);
    try {
      onChange([...photos, ...(await Promise.all(chosen.map(compress)))]);
    } catch {
      setError("That photo could not be read. Try taking it again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="evidence">
      <div className="evidence__head">
        <span>Photos <small>(optional, up to {MAX_PHOTOS})</small></span>
        {photos.length < MAX_PHOTOS ? (
          <label className="button button--quiet evidence__add" htmlFor={id}>
            <Camera aria-hidden="true" /> {busy ? "Adding…" : photos.length ? "Add another" : "Take or add photos"}
          </label>
        ) : null}
        <input id={id} className="sr-only" type="file" accept="image/*" capture="environment" multiple aria-label="Take or add photos" onChange={(event) => { void add(event.target.files); event.target.value = ""; }} />
      </div>
      {photos.length ? (
        <ul className="evidence__photos" aria-label="Photos added">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not an optimisable remote image */}
              <img src={photo.dataUrl} alt={`Photo ${index + 1} of the issue`} />
              <button type="button" className="evidence__remove" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange(photos.filter((item) => item.id !== photo.id))}><X /></button>
            </li>
          ))}
        </ul>
      ) : <p className="evidence__hint">A clear photo of the problem helps the supervisor decide faster.</p>}
      {error ? <small className="field-error" role="alert">{error}</small> : null}
    </div>
  );
}

export function LocationShare({ location, onChange }: { location: ReportedLocation | null; onChange: (location: ReportedLocation | null) => void }) {
  const [state, setState] = useState<"idle" | "finding" | "error">("idle");
  const [message, setMessage] = useState("");
  const find = () => {
    if (!("geolocation" in navigator)) {
      setState("error");
      setMessage("This phone cannot share its location. Choose the operating area instead.");
      return;
    }
    setState("finding");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState("idle");
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: Math.round(position.coords.accuracy) });
      },
      (failure) => {
        setState("error");
        setMessage(failure.code === failure.PERMISSION_DENIED ? "Location is switched off for VESPER. Allow it in the phone's settings, or choose the operating area instead." : "Your location could not be found. Try again in the open, or choose the operating area instead.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };
  return (
    <div className="evidence">
      <div className="evidence__head">
        <span>Location <small>(optional)</small></span>
        {!location ? (
          <button type="button" className="button button--quiet evidence__add" onClick={find} disabled={state === "finding"}>
            <LocateFixed aria-hidden="true" /> {state === "finding" ? "Finding you…" : "Add my location"}
          </button>
        ) : null}
      </div>
      {location ? (
        <div className="evidence__location">
          <MapPin aria-hidden="true" />
          <span><strong>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</strong><small>Accurate to about {location.accuracyM} m</small></span>
          <button type="button" className="icon-button icon-button--light" aria-label="Remove the location" onClick={() => onChange(null)}><X /></button>
        </div>
      ) : <p className="evidence__hint">Only added when you ask, and only to this report.</p>}
      {state === "error" ? <small className="field-error" role="alert">{message}</small> : null}
    </div>
  );
}

/** Photos and location shown on an issue (the phone's issue page and the issue page on the web). */
export function ReportEvidence({ photos, location }: { photos: IssuePhoto[] | undefined; location: ReportedLocation | null | undefined }) {
  if (!photos?.length && !location) return null;
  return (
    <div className="evidence evidence--view">
      {photos?.length ? (
        <ul className="evidence__photos" aria-label="Photos with the report">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <a href={photo.dataUrl} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a stored data URL, not an optimisable remote image */}
                <img src={photo.dataUrl} alt={`Photo ${index + 1} with the report`} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {location ? (
        <div className="evidence__location">
          <MapPin aria-hidden="true" />
          <span><strong>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</strong><small>Reporter&apos;s location, accurate to about {location.accuracyM} m</small></span>
        </div>
      ) : null}
    </div>
  );
}
