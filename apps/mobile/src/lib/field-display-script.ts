/**
 * The display settings' storage key and the script that applies them in <head> before the first paint (no React here, so the
 * root layout, a server component, can include it). See field-display.ts.
 */
export const FIELD_DISPLAY_KEY = "vesper-field-display-v1";

/** Runs in <head> so the page never flashes in the wrong size or contrast. */
export const fieldDisplayInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem("${FIELD_DISPLAY_KEY}")||"{}");var r=document.documentElement;if(s.gloves)r.dataset.gloves="on";if(s.sunlight)r.dataset.contrast="high"}catch(e){}})();`;
