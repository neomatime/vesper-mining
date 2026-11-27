/**
 * Finding a machine from what a QR label (or a person) gives: the label's link to the machine page in VESPER Mobile
 * (…/machines/eq-ex204), a VESPER code (vesper:equipment:eq-ex204), the record id, or the fleet number painted on the machine
 * (EX-204, ex204, EX 204). A label holds the link, so the phone's own camera app opens VESPER Mobile on the machine as well.
 */
type Machine = { id: string; code: string };

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The machine a scanned or typed text refers to, or null when none matches. */
export function machineFromCode<T extends Machine>(text: string, machines: T[]): T | null {
  const value = text.trim();
  if (!value) return null;
  const fromLink = /\/machines\/([^/?#\s]+)/.exec(value)?.[1];
  const fromCode = /^vesper:equipment:(.+)$/i.exec(value)?.[1];
  const id = fromLink ?? fromCode ?? value;
  const byId = machines.find((machine) => machine.id === decodeURIComponent(id));
  if (byId) return byId;
  const wanted = squash(value);
  return machines.find((machine) => squash(machine.code) === wanted) ?? null;
}

/** What a machine's QR label holds: its page in VESPER Mobile (the full address when known, otherwise the VESPER code). */
export function machineLabelText(machine: Machine, mobileOrigin: string | null) {
  return mobileOrigin ? `${mobileOrigin.replace(/\/$/, "")}/machines/${machine.id}` : `vesper:equipment:${machine.id}`;
}
