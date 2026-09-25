import { CANVAS, type Doc, type WordObj } from './model';
import { FONTS } from './presets';

// ---------- glyph measurement ----------
const measureCtx = document.createElement('canvas').getContext('2d')!;
const widthCache = new Map<string, number>();

function glyphWidth(ch: string, fontKey: string): number {
  const key = fontKey + '\u0000' + ch;
  let w = widthCache.get(key);
  if (w === undefined) {
    const f = FONTS[fontKey] ?? FONTS.block;
    measureCtx.font = `${f.style ?? 'normal'} ${f.weight} 100px ${f.family}`;
    w = Math.max(measureCtx.measureText(ch).width, ch === ' ' ? 28 : 8);
    widthCache.set(key, w);
  }
  return w;
}
/** Fonts can finish loading after first measure — call to re-measure. */
export const clearMeasureCache = () => widthCache.clear();

// ---------- shape envelopes ----------
interface GlyphPlace { ch: string; x: number; y: number; angle: number; skew: boolean; sx: number; sy: number }

export function layoutGlyphs(o: WordObj): GlyphPlace[] {
  const chars = [...(o.text || ' ')];
  const widths = chars.map((c) => glyphWidth(c, o.font));
  const total = widths.reduce((a, b) => a + b, 0) + o.tracking * Math.max(0, chars.length - 1);
  const sx = o.w / Math.max(total, 1);
  const baseSy = o.h / 100;
  const b = o.bend;
  const A = o.w * 0.3;
  const out: GlyphPlace[] = [];
  let cursor = 0;

  chars.forEach((ch, i) => {
    const t = (cursor + widths[i] / 2) / Math.max(total, 1);
    cursor += widths[i] + o.tracking;
    const u = t * 2 - 1;
    let x = (t - 0.5) * o.w;
    let y = 0;
    let angle = 0;
    let skew = false;
    let s = 1;

    const curve = (fn: (u: number) => number, useSkew = false) => {
      y = fn(u);
      const d = (fn(u + 0.001) - fn(u - 0.001)) / 0.002; // dy/du
      angle = (Math.atan2(d, o.w / 2) * 180) / Math.PI;
      skew = useSkew;
    };

    switch (o.shape) {
      case 'bogen': curve((v) => -b * A * (1 - v * v)); break;
      case 'welle': curve((v) => b * A * 0.45 * Math.sin(v * Math.PI * 1.25)); break;
      case 'flagge': curve((v) => b * A * 0.3 * Math.sin(v * Math.PI * 2), true); break;
      case 'steigung': curve((v) => -b * A * 0.9 * v, true); break;
      case 'woelbung': s = 1 + b * 1.0 * (1 - u * u); break;
      case 'taille': s = 1 - b * 0.65 * (1 - u * u); break;
      case 'perspektive': s = 1 - b * 0.55 * u; break;
      case 'spitze': s = 1 + b * 1.1 * (1 - Math.abs(u)); y = -(s - 1) * o.h * 0.36; break;
      case 'kreis': {
        const span = Math.max(0.35, Math.abs(b)) * Math.PI * 2 * 0.999;
        const r = o.w / span;
        const phi = (t - 0.5) * span;
        const top = b >= 0;
        x = r * Math.sin(phi);
        y = top ? -r * Math.cos(phi) : r * Math.cos(phi);
        angle = ((top ? phi : -phi) * 180) / Math.PI;
        break;
      }
    }
    out.push({ ch, x, y, angle, skew, sx, sy: baseSy * Math.max(0.08, s) });
  });
  return out;
}

// ---------- helpers ----------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = (n: number) => Math.round(n * 100) / 100;

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((c) => c.toString(16).padStart(2, '0')).join('');
}

const RAINBOW = ['#ff2a2a', '#ff9a00', '#fff200', '#27e34b', '#1ea7ff', '#8a2bff'];

function stops(o: WordObj): string {
  const s = (off: number, c: string) => `<stop offset="${off}" stop-color="${c}"/>`;
  switch (o.fillType) {
    case 'einfarbig': return s(0, o.fillA) + s(1, o.fillA);
    case 'chrom': return s(0, o.fillA) + s(0.48, o.fillB) + s(0.52, shade(o.fillA, -0.05)) + s(0.78, o.fillA) + s(1, shade(o.fillB, -0.25));
    case 'regenbogen': return RAINBOW.map((c, i) => s(i / (RAINBOW.length - 1), c)).join('');
    default: return s(0, o.fillA) + s(1, o.fillB);
  }
}

// ---------- object ----------
export function renderObject(o: WordObj, ns: string): string {
  const f = FONTS[o.font] ?? FONTS.block;
  const glyphs = layoutGlyphs(o);
  const id = `${ns}-${o.id}`;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const texts = glyphs.map((g) => {
    const rho = Math.max(glyphWidth(g.ch, o.font) * g.sx, 100 * g.sy) * 0.75;
    minX = Math.min(minX, g.x - rho); maxX = Math.max(maxX, g.x + rho);
    minY = Math.min(minY, g.y - rho); maxY = Math.max(maxY, g.y + rho);
    if (g.ch === ' ') return '';
    const turn = g.skew ? `skewY(${r2(g.angle)})` : `rotate(${r2(g.angle)})`;
    return `<text transform="translate(${r2(g.x)} ${r2(g.y)}) ${turn} scale(${r2(g.sx)} ${r2(g.sy)})">${esc(g.ch)}</text>`;
  }).join('');

  const pad = o.outlineWidth + o.depth * 2 + 20;
  const bx = minX - pad, by = minY - pad, bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const a = (o.fillAngle * Math.PI) / 180;
  const L = Math.abs(Math.cos(a)) * (maxX - minX) / 2 + Math.abs(Math.sin(a)) * (maxY - minY) / 2 || 1;

  const rot = (o.rotation * Math.PI) / 180;
  const sdx = o.shadowDist * 0.75, sdy = o.shadowDist;
  // counter-rotate so the shadow always falls in the same world direction
  const shx = sdx * Math.cos(-rot) - sdy * Math.sin(-rot);
  const shy = sdx * Math.sin(-rot) + sdy * Math.cos(-rot);

  const fontAttr = `font-family="${esc(f.family)}" font-weight="${f.weight}"${f.style ? ` font-style="${f.style}"` : ''} font-size="100" text-anchor="middle" dominant-baseline="central"`;
  const strokeW = Math.max(o.outlineWidth * 2, 0);

  let depth = '';
  const da = (o.depthAngle * Math.PI) / 180;
  for (let i = o.depth; i > 0; i--) {
    const k = i * 1.6;
    const c = shade(o.depthColor, -0.45 * (i / Math.max(o.depth, 1)));
    depth += `<use href="#${id}-g" transform="translate(${r2(Math.cos(da) * k)} ${r2(Math.sin(da) * k)})" fill="${c}" stroke="${c}" stroke-width="${Math.max(strokeW, 3)}"/>`;
  }

  return `<g class="obj" data-id="${o.id}" transform="translate(${r2(o.x)} ${r2(o.y)}) rotate(${r2(o.rotation)})">
<defs>
<g id="${id}-g" ${fontAttr} stroke-linejoin="round" stroke-linecap="round">${texts}</g>
<linearGradient id="${id}-f" gradientUnits="userSpaceOnUse" x1="${r2(cx - Math.cos(a) * L)}" y1="${r2(cy - Math.sin(a) * L)}" x2="${r2(cx + Math.cos(a) * L)}" y2="${r2(cy + Math.sin(a) * L)}">${stops(o)}</linearGradient>
<mask id="${id}-m" maskUnits="userSpaceOnUse" x="${r2(bx)}" y="${r2(by)}" width="${r2(bw)}" height="${r2(bh)}"><use href="#${id}-g" fill="#fff"/></mask>
<filter id="${id}-s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${r2(shx)}" dy="${r2(shy)}" stdDeviation="4" flood-color="${o.shadowColor}" flood-opacity=".7"/></filter>
</defs>
<g class="body"${o.shadow ? ` filter="url(#${id}-s)"` : ''}>
${depth}
${o.outlineWidth > 0 ? `<use href="#${id}-g" fill="${o.outline}" stroke="${o.outline}" stroke-width="${strokeW}"/>` : ''}
<rect x="${r2(bx)}" y="${r2(by)}" width="${r2(bw)}" height="${r2(bh)}" fill="url(#${id}-f)" mask="url(#${id}-m)"/>
</g>
<rect class="hit" x="${r2(minX)}" y="${r2(minY)}" width="${r2(maxX - minX)}" height="${r2(maxY - minY)}" fill="transparent"/>
</g>`;
}

// ---------- document ----------
export function renderBackground(doc: Doc, ns: string): string {
  const { w, h } = CANVAS;
  switch (doc.background) {
    case 'transparent': return '';
    case 'farbe': return `<rect width="${w}" height="${h}" fill="${doc.bgColor}"/>`;
    case 'himmel': return `<defs><linearGradient id="${ns}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f7ae0"/><stop offset=".62" stop-color="#9fd8ff"/><stop offset=".62" stop-color="#5fbf3f"/><stop offset="1" stop-color="#2f8a2a"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#${ns}-sky)"/>`;
    case 'raster': {
      let grid = '';
      for (let x = 50; x < w; x += 50) grid += `M${x} 0V${h}`;
      for (let y = 50; y < h; y += 50) grid += `M0 ${y}H${w}`;
      return `<rect width="${w}" height="${h}" fill="#f7f5ef"/><path d="${grid}" stroke="#dcd8cc" stroke-width="1" fill="none"/>`;
    }
    default: return `<rect width="${w}" height="${h}" fill="#f7f5ef"/>`;
  }
}

export function renderDoc(doc: Doc, ns: string): string {
  return `<g class="bg">${renderBackground(doc, ns)}</g>` + doc.objects.map((o) => renderObject(o, ns)).join('');
}

/** Standalone SVG markup (no selection UI) for export. */
export function docToSvg(doc: Doc): string {
  const { w, h } = CANVAS;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${renderDoc(doc, 'x')}</svg>`
    .replace(/<rect class="hit"[^>]*\/>/g, '');
}
