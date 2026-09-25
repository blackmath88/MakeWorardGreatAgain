import type { ShapeId, Style } from './model';

export interface FontDef { label: string; family: string; weight: number; style?: 'italic' }

// System fonts only: Discord's iframe CSP blocks web-font hosts, and SVG→PNG export can't embed them anyway.
export const FONTS: Record<string, FontDef> = {
  block:    { label: 'Arial Black',  family: '"Arial Black", "Arial Bold", Arial, sans-serif', weight: 900 },
  impact:   { label: 'Impact',       family: 'Impact, Haettenschweiler, "Arial Narrow", sans-serif', weight: 400 },
  times:    { label: 'Times Kursiv', family: '"Times New Roman", Times, serif', weight: 700, style: 'italic' },
  georgia:  { label: 'Georgia',      family: 'Georgia, "Times New Roman", serif', weight: 700 },
  comic:    { label: 'Comic Sans',   family: '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive', weight: 700 },
  courier:  { label: 'Courier',      family: '"Courier New", Courier, monospace', weight: 700 },
  trebuchet:{ label: 'Trebuchet',    family: '"Trebuchet MS", Verdana, sans-serif', weight: 700 },
  verdana:  { label: 'Verdana',      family: 'Verdana, Geneva, sans-serif', weight: 700 },
  brush:    { label: 'Brush Script', family: '"Brush Script MT", "Segoe Script", cursive', weight: 400, style: 'italic' },
  papyrus:  { label: 'Papyrus',      family: 'Papyrus, fantasy', weight: 400 },
};

export const SHAPES: { id: ShapeId; label: string; icon: string }[] = [
  { id: 'gerade',      label: 'Gerade',      icon: 'M4 16H36' },
  { id: 'bogen',       label: 'Bogen',       icon: 'M4 22Q20 2 36 22' },
  { id: 'welle',       label: 'Welle',       icon: 'M4 16C10 4 14 28 20 16S30 4 36 16' },
  { id: 'flagge',      label: 'Flagge',      icon: 'M4 12C12 4 14 20 20 12S30 4 36 12M4 24C12 16 14 32 20 24S30 16 36 24' },
  { id: 'steigung',    label: 'Steigung',    icon: 'M4 26L36 8M4 34L36 16' },
  { id: 'kreis',       label: 'Kreis',       icon: 'M20 4A13 13 0 1 1 19.9 4' },
  { id: 'woelbung',    label: 'Wölbung',     icon: 'M4 12Q20 0 36 12M4 24Q20 36 36 24' },
  { id: 'taille',      label: 'Taille',      icon: 'M4 4Q20 18 36 4M4 32Q20 18 36 32' },
  { id: 'perspektive', label: 'Perspektive', icon: 'M4 4L36 13M4 32L36 23' },
  { id: 'spitze',      label: 'Spitze',      icon: 'M4 18L20 4L36 18M4 30H36' },
];

export interface Preset { id: string; label: string; style: Style }

const base: Style = {
  font: 'block', shape: 'gerade', bend: 0.5, tracking: 0,
  fillType: 'verlauf', fillA: '#fff45c', fillB: '#ff25ba', fillAngle: 90,
  outline: '#42126f', outlineWidth: 6,
  depth: 12, depthAngle: 45, depthColor: '#42126f',
  shadow: true, shadowColor: '#1c2f9d', shadowDist: 14,
};

const p = (id: string, label: string, s: Partial<Style>): Preset => ({ id, label, style: { ...base, ...s } });

export const PRESETS: Preset[] = [
  p('chrome', 'Chrom', { fillType: 'chrom', fillA: '#f7fbff', fillB: '#536879', outline: '#0b1826', depthColor: '#1b2c3d', depth: 14, shape: 'bogen', bend: 0.55 }),
  p('rainbow', 'Regenbogen', { fillType: 'regenbogen', outline: '#4420a8', depthColor: '#2a1470', depth: 11, shape: 'welle', bend: 0.5 }),
  p('corporate', 'Firma 2001', { fillA: '#8fe8ff', fillB: '#0751c9', outline: '#052a71', depthColor: '#052a71', depth: 8, shape: 'gerade', tracking: 4 }),
  p('bubblegum', 'Kaugummi', { font: 'comic', fillA: '#fff0fb', fillB: '#ff4aad', outline: '#a6006f', depthColor: '#a6006f', depth: 7, shape: 'woelbung', bend: 0.6 }),
  p('lime', 'Limette', { font: 'impact', fillA: '#f1ff54', fillB: '#28cf45', outline: '#005e38', depthColor: '#005e38', depth: 18, shape: 'steigung', bend: 0.6 }),
  p('gold', 'Gold', { font: 'times', fillType: 'chrom', fillA: '#fff6a0', fillB: '#b56d00', outline: '#4a2600', depthColor: '#4a2600', depth: 16, shape: 'bogen', bend: 0.4 }),
  p('flame', 'Flamme', { font: 'impact', fillA: '#fff15a', fillB: '#ff4218', fillAngle: 270, outline: '#781000', depthColor: '#781000', depth: 10, shape: 'spitze', bend: 0.7 }),
  p('ice', 'Eis', { fillA: '#ffffff', fillB: '#7ae7ff', outline: '#006699', depthColor: '#5fb8d8', depth: 6, shape: 'taille', bend: 0.45, tracking: 6, shadow: false }),
  p('vapor', 'Vapor 86', { font: 'trebuchet', fillType: 'chrom', fillA: '#ffffff', fillB: '#ff3ec8', outline: '#00e1ff', outlineWidth: 4, depthColor: '#5a1a9c', depth: 16, depthAngle: 70, shape: 'perspektive', bend: 0.5, shadowColor: '#00e1ff' }),
  p('toxic', 'Giftig', { font: 'block', fillA: '#d6ff00', fillB: '#1a1a1a', fillAngle: 0, outline: '#000000', depthColor: '#6f7f00', depth: 20, depthAngle: 135, shape: 'flagge', bend: 0.6, shadowColor: '#000000' }),
  p('newspaper', 'Schlagzeile', { font: 'georgia', fillType: 'einfarbig', fillA: '#111111', outline: '#ffffff', outlineWidth: 3, depth: 0, shape: 'gerade', shadowColor: '#888888', shadowDist: 8 }),
  p('circus', 'Zirkus', { font: 'papyrus', fillA: '#ffe14d', fillB: '#e0161b', outline: '#3b0a00', depthColor: '#7a1300', depth: 9, shape: 'kreis', bend: 0.55, tracking: 8 }),
];

export const DEFAULT_STYLE = PRESETS[0].style;

export const SAMPLE_WORDS = [
  'MAKE IT LOUD', 'GRÜEZI MITENAND', 'GG WP', 'FEIERABEND', 'NICE!', 'LUMPESAMMLIG',
  'BRB SNACKS', 'KEINE KI NÖTIG', 'WOW', 'MONTAG', 'LEGENDÄR', 'SUPER COOL',
];
