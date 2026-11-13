/**
 * Builds VESPER's dark stylesheet from its light one.
 *
 * Every rule in the light stylesheet that sets a colour is re-emitted under `:root[data-theme="dark"]` with its
 * colours mapped for a dark surface:
 *   - light backgrounds become dark surfaces of the same hue,
 *   - dark text becomes light text,
 *   - light borders become dark borders,
 *   - mid-tone colours (the emerald brand colour, status colours) and anything already dark are left alone,
 *   - translucent whites (hover highlights on dark bars) are left alone.
 * Rules that style surfaces which are already dark in the light theme (top bar, hero card, sign-in) are skipped.
 *
 * Rules are re-emitted even when a colour does not change, so the order and weight of rules that override one another
 * stays the same as in the light theme.
 *
 * The output is committed as `src/app/dark.generated.css`. Regenerate it after editing `globals.css` or `theme.css`:
 *   node scripts/generate-dark-theme.mjs
 * A unit test fails when the committed file is out of date.
 */

/* ------------------------------------------------------------------------------------------------ colour maths */

function clamp(value, low = 0, high = 1) {
  return Math.min(high, Math.max(low, value));
}

export function parseColor(token) {
  const text = token.trim().toLowerCase();
  let match = /^#([0-9a-f]{3,8})$/.exec(text);
  if (match) {
    let hex = match[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (hex.length !== 6 && hex.length !== 8) return null;
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
  }
  match = /^rgba?\(([^)]*)\)$/.exec(text);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (value) => (value.endsWith("%") ? (parseFloat(value) / 100) * 255 : parseFloat(value));
    return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]) };
  }
  return null;
}

export function toHsl({ r, g, b, a }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  const delta = max - min;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l, a };
}

export function fromHsl({ h, s, l, a }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a };
}

function format({ r, g, b, a }) {
  const hex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  if (a >= 0.999) return `#${hex(r)}${hex(g)}${hex(b)}`;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}

const NEUTRAL_HUE = 160;

/** A grey, judged by how far apart its red, green and blue are. Saturation misleads for near-white colours. */
function isNeutral({ r, g, b }) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255 < 0.045;
}

/** A light background becomes a dark surface of the same hue. Mid tones, dark colours and translucent whites stay. */
export function mapBackground(color) {
  const { h, s, l, a } = toHsl(color);
  if (l < 0.78 || a < 0.5) return color;
  const neutral = isNeutral(color);
  return fromHsl({ h: neutral ? NEUTRAL_HUE : h, s: neutral ? 0.1 : Math.min(s, 0.42) * 0.9, l: 0.105 + (1 - l) * 0.575, a });
}

/** Dark text becomes light text. Light text already sits on something dark and stays. */
export function mapText(color) {
  const { h, s, l, a } = toHsl(color);
  if (l > 0.55) return color;
  return fromHsl({ h, s: s * 0.55, l: clamp(0.97 - l * 0.7, 0.55, 0.97), a });
}

/** A light border becomes a dark one, a little lighter than the surface it sits on. */
export function mapBorder(color) {
  const { h, s, l, a } = toHsl(color);
  if (l < 0.75 || a < 0.5) return color;
  const neutral = isNeutral(color);
  return fromHsl({ h: neutral ? NEUTRAL_HUE : h, s: neutral ? 0.1 : Math.min(s, 0.3) * 0.8, l: Math.max(0.3 - (l - 0.75) * 0.7, 0.12), a });
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function mapValue(value, mapper) {
  // Leave url(...) alone: it holds image data, not colours to remap.
  return value
    .split(/(url\((?:[^()]|\([^)]*\))*\))/g)
    .map((part) => (part.startsWith("url(") ? part : part.replace(COLOR_TOKEN, (token) => {
      const parsed = parseColor(token);
      return parsed ? format(mapper(parsed)) : token;
    })))
    .join("");
}

/* ------------------------------------------------------------------------------------------------ CSS parsing */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Index of the character that closes the block opened at `open`, ignoring braces inside strings and url(...). */
function closingBrace(css, open) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < css.length; i += 1) {
    const char = css[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      current += char;
      if (char === "\\") {
        current += text[i + 1] ?? "";
        i += 1;
      } else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function parseCss(source) {
  const css = stripComments(source);
  const nodes = [];
  let index = 0;
  while (index < css.length) {
    // Read a prelude up to "{" or ";" outside strings and parentheses.
    let depth = 0;
    let quote = "";
    let end = -1;
    for (let i = index; i < css.length; i += 1) {
      const char = css[i];
      if (quote) {
        if (char === "\\") i += 1;
        else if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if ((char === "{" || char === ";") && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) break;
    const prelude = css.slice(index, end).trim();
    if (css[end] === ";") {
      index = end + 1;
      continue;
    }
    const close = closingBrace(css, end);
    const body = css.slice(end + 1, close);
    index = close + 1;
    if (!prelude) continue;
    if (prelude.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(prelude)?.[1] ?? "";
      if (name === "media" || name === "supports") nodes.push({ type: "at", name, params: prelude.slice(name.length + 1).trim(), children: parseCss(body) });
      continue;
    }
    const decls = splitTopLevel(body, ";")
      .map((entry) => {
        const colon = entry.indexOf(":");
        return colon === -1 ? null : { prop: entry.slice(0, colon).trim(), value: entry.slice(colon + 1).trim() };
      })
      .filter(Boolean);
    nodes.push({ type: "rule", selector: prelude, decls });
  }
  return nodes;
}

/* ------------------------------------------------------------------------------------------------ generation */

const SCOPE = ':root[data-theme="dark"]';

/** Surfaces that are already dark in the light theme, or that need hand-made dark versions in `dark.css`. */
const SKIP = [
  ".topbar", ".signin__brand", ".signin__statement", ".signin__mark", ".signin__contours", ".brand-loader", ".hero-card", ".mobile-hero",
  ".demo-launcher", ".button--light", ".leaflet", ".wordmark", ".profile-chip", ".search-trigger", ".site-selector", ".route-progress",
  ".dialog-backdrop", ".modal-backdrop",
];

function mapperFor(prop) {
  const name = prop.toLowerCase();
  if (name.startsWith("--")) {
    if (/(^|-)(bg|background|soft|tint|surface|fill)(-|$)/.test(name)) return mapBackground;
    if (/(^|-)(ink|text|fg|color)(-|$)/.test(name)) return mapText;
    if (/(^|-)(edge|border|line|stroke)(-|$)/.test(name)) return mapBorder;
    return null;
  }
  if (/^(background|background-color|background-image)$/.test(name)) return mapBackground;
  if (/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/.test(name)) return mapText;
  if (/^(border(-(top|right|bottom|left|inline|block)(-(start|end))?)?(-color)?|outline(-color)?)$/.test(name)) return mapBorder;
  return null;
}

function scopeSelector(selector) {
  return splitTopLevel(selector, ",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part === ":root" || part === "html") return SCOPE;
      if (part.startsWith("html ")) return `${SCOPE} ${part.slice(5)}`;
      if (part.startsWith(":root ")) return `${SCOPE} ${part.slice(6)}`;
      return `${SCOPE} ${part}`;
    })
    .join(",\n");
}

function emit(nodes, indent = "") {
  const out = [];
  for (const node of nodes) {
    if (node.type === "at") {
      const inner = emit(node.children, `${indent}  `);
      if (inner.length) out.push(`${indent}@${node.name} ${node.params} {\n${inner.join("\n")}\n${indent}}`);
      continue;
    }
    if (/^(:root|html)$/.test(node.selector.trim()) || SKIP.some((token) => node.selector.includes(token))) continue;
    const lines = [];
    for (const decl of node.decls) {
      const mapper = mapperFor(decl.prop);
      if (!mapper) continue;
      lines.push(`${indent}  ${decl.prop}: ${mapValue(decl.value, mapper)};`);
    }
    if (lines.length) out.push(`${indent}${scopeSelector(node.selector).replace(/\n/g, `\n${indent}`)} {\n${lines.join("\n")}\n${indent}}`);
  }
  return out;
}

/** The dark stylesheet for one or more light stylesheets, given in the order they load. */
export function generateDarkTheme(sources) {
  const header = "/* GENERATED by scripts/generate-dark-theme.mjs from globals.css and theme.css. Do not edit by hand: put changes in dark.css. */\n";
  return `${header}${emit(sources.flatMap((source) => parseCss(source))).join("\n")}\n`;
}
