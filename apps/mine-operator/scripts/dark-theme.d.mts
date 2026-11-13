export type Rgba = { r: number; g: number; b: number; a: number };
export type Hsla = { h: number; s: number; l: number; a: number };
export function parseColor(token: string): Rgba | null;
export function toHsl(color: Rgba): Hsla;
export function fromHsl(color: Hsla): Rgba;
export function mapBackground(color: Rgba): Rgba;
export function mapText(color: Rgba): Rgba;
export function mapBorder(color: Rgba): Rgba;
export type CssNode =
  | { type: "rule"; selector: string; decls: { prop: string; value: string }[] }
  | { type: "at"; name: string; params: string; children: CssNode[] };
export function parseCss(source: string): CssNode[];
export function generateDarkTheme(sources: string[]): string;
