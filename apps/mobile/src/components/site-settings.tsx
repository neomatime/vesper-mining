"use client";

/**
 * Working on site: the gloves and sunlight switches (Profile tab), and the card that offers to install VESPER Mobile on the phone
 * (My Shift). Android and desktop Chrome install with one tap; on an iPhone the card explains Share, then Add to Home Screen.
 */
import { Download, Hand, Share, Sun, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useInstallApp } from "@core/components/use-install-app";
import { setFieldDisplay, useFieldDisplay } from "@/lib/field-display";

function Switch({ label, detail, icon: Icon, on, onChange }: { label: string; detail: string; icon: typeof Sun; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`site-switch ${on ? "is-on" : ""}`} onClick={() => onChange(!on)}>
      <Icon aria-hidden="true" />
      <span><strong>{label}</strong><small>{detail}</small></span>
      <span className="site-switch__track" aria-hidden="true"><span /></span>
    </button>
  );
}

export function SiteDisplaySettings() {
  const display = useFieldDisplay();
  return (
    <section className="mobile-stack" aria-labelledby="on-site">
      <h2 id="on-site">On site</h2>
      <Switch label="Gloves mode" detail="Bigger buttons and text, more space between them" icon={Hand} on={display.gloves} onChange={(gloves) => setFieldDisplay({ gloves })} />
      <Switch label="Sunlight mode" detail="Stronger contrast for reading in bright light" icon={Sun} on={display.sunlight} onChange={(sunlight) => setFieldDisplay({ sunlight })} />
    </section>
  );
}

const DISMISSED_KEY = "vesper-install-dismissed-v1";
const noop = () => () => undefined;

/** iPhone or iPad Safari, not already opened from the home screen: it installs from the Share menu, not with a prompt. */
function isAppleBrowser() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return /iphone|ipad|ipod/i.test(nav.userAgent) && !nav.standalone;
}

export function InstallCard() {
  const { canInstall, install } = useInstallApp();
  const apple = useSyncExternalStore(noop, isAppleBrowser, () => false);
  const remembered = useSyncExternalStore(noop, () => { try { return window.localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; } }, () => true);
  const [hidden, setHidden] = useState(false);
  if (hidden || remembered || (!canInstall && !apple)) return null;
  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* the card stays hidden for this visit */ }
  };
  return (
    <article className="mobile-card install-card" aria-label="Install VESPER Mobile">
      <Download />
      <div>
        <strong>Install VESPER Mobile</strong>
        {canInstall ? <p>Open it from your home screen, full screen, like any other app.</p> : <p>Tap <Share aria-label="Share" className="install-card__share" /> Share, then <strong>Add to Home Screen</strong>.</p>}
        {canInstall ? <button type="button" className="button button--primary install-card__button" onClick={() => void install()}>Install</button> : null}
      </div>
      <button type="button" className="icon-button icon-button--light" aria-label="Not now" onClick={dismiss}><X /></button>
    </article>
  );
}
