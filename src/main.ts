import { CANVAS, clone, newObject, uid, type Doc, type Style, type WordObj } from './model';
import { DEFAULT_STYLE, FONTS, PRESETS, SAMPLE_WORDS, SHAPES } from './presets';
import { renderDoc, renderObject } from './render';
import { download, pngBlob, svgBlob } from './export';
import { inDiscord, initDiscord, shareImage, user } from './discord';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const svg = $('art') as unknown as SVGSVGElement;
const content = $('content') as unknown as SVGGElement;
const overlay = $('overlay') as unknown as SVGGElement;

// ---------- state ----------
const STORAGE_KEY = 'mwga-doc-v1';
let doc: Doc = load() ?? {
  objects: [newObject(DEFAULT_STYLE, 'MAKE IT LOUD', { bend: 0.55 })],
  background: 'raster',
  bgColor: '#ffe45c',
};
let selectedId: string | null = doc.objects[0]?.id ?? null;
let lastStyle: Style = DEFAULT_STYLE;

const selected = () => doc.objects.find((o) => o.id === selectedId) ?? null;

function load(): Doc | null {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); } catch { /* storage blocked */ }
}

// ---------- history ----------
let history: string[] = [JSON.stringify(doc)];
let hIndex = 0;

function commit() {
  const snap = JSON.stringify(doc);
  if (snap === history[hIndex]) return;
  history = history.slice(0, hIndex + 1);
  history.push(snap);
  if (history.length > 150) history.shift();
  hIndex = history.length - 1;
  persist();
  syncToolbar();
}
function restore(i: number) {
  hIndex = i;
  doc = JSON.parse(history[i]);
  if (!selected()) selectedId = doc.objects.at(-1)?.id ?? null;
  persist();
  renderAll();
}
const undo = () => hIndex > 0 && restore(hIndex - 1);
const redo = () => hIndex < history.length - 1 && restore(hIndex + 1);

// ---------- rendering ----------
function renderAll() {
  content.innerHTML = renderDoc(doc, 'st');
  $('stage').classList.toggle('checker', doc.background === 'transparent');
  renderOverlay();
  syncPanel();
  syncToolbar();
}

/** Cheap path while dragging a slider: re-render only the edited object. */
function renderOne(o: WordObj) {
  const old = content.querySelector(`.obj[data-id="${o.id}"]`);
  if (!old) return renderAll();
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  tmp.innerHTML = renderObject(o, 'st');
  old.replaceWith(tmp.firstElementChild!);
  renderOverlay();
}

let guide: 'x' | 'y' | 'xy' | null = null;

function renderOverlay() {
  const o = selected();
  if (!o) { overlay.innerHTML = ''; return; }
  const hit = content.querySelector<SVGRectElement>(`.obj[data-id="${o.id}"] .hit`);
  if (!hit) { overlay.innerHTML = ''; return; }
  const b = hit.getBBox();
  const k = CANVAS.w / Math.max(svg.clientWidth, 1); // keep handles a constant screen size
  const pad = 8 * k, r = 7 * k;
  const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.width + pad, y1 = b.y + b.height + pad;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const handles: [string, number, number][] = [
    ['nw', x0, y0], ['n', mx, y0], ['ne', x1, y0], ['w', x0, my], ['e', x1, my], ['sw', x0, y1], ['s', mx, y1], ['se', x1, y1],
  ];
  const dy = my - o.bend * (y1 - y0) / 2;
  const d = 8 * k;
  let guides = '';
  if (guide?.includes('x')) guides += `<path class="guide" d="M${CANVAS.w / 2} 0V${CANVAS.h}"/>`;
  if (guide?.includes('y')) guides += `<path class="guide" d="M0 ${CANVAS.h / 2}H${CANVAS.w}"/>`;
  overlay.innerHTML = guides + `<g transform="translate(${o.x} ${o.y}) rotate(${o.rotation})">
    <rect class="sel" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>
    <path class="sel" d="M${mx} ${y0}V${y0 - 34 * k}"/>
    <circle class="handle rot" data-h="rot" cx="${mx}" cy="${y0 - 42 * k}" r="${r}"/>
    ${handles.map(([h, x, y]) => `<circle class="handle" data-h="${h}" cx="${x}" cy="${y}" r="${r}"/>`).join('')}
    <path class="handle bend" data-h="bend" d="M${x0 + 20 * k} ${dy - d}l${d} ${d}l${-d} ${d}l${-d} ${-d}z"/>
  </g>`;
}

// ---------- panel ----------
const props = $<HTMLFieldSetElement>('props');
const fontSel = $<HTMLSelectElement>('font');
fontSel.innerHTML = Object.entries(FONTS).map(([k, f]) => `<option value="${k}" style="font-family:${f.family.replace(/"/g, "'")}">${f.label}</option>`).join('');

const fmt: Record<string, (v: number) => string> = {
  bend: (v) => `${Math.round(v * 100)}%`,
  fillAngle: (v) => `${v}°`, depthAngle: (v) => `${v}°`, rotation: (v) => `${Math.round(v)}°`,
};

function syncPanel() {
  const o = selected();
  props.disabled = !o;
  $('status').textContent = o ? `OBJEKT AUSGEWÄHLT · ${doc.objects.length} TOTAL` : `${doc.objects.length} OBJEKT(E) · NICHTS AUSGEWÄHLT`;
  props.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-prop]').forEach((el) => {
    if (!o || document.activeElement === el) return;
    const key = el.dataset.prop as keyof WordObj;
    const v = o[key];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(v);
    else if (el.dataset.scale) el.value = String(Math.round(Number(v) * Number(el.dataset.scale)));
    else el.value = String(v);
  });
  props.querySelectorAll<HTMLOutputElement>('[data-out]').forEach((out) => {
    if (!o) { out.textContent = ''; return; }
    const key = out.dataset.out as keyof WordObj;
    const v = Number(o[key]);
    out.textContent = fmt[key]?.(v) ?? String(Math.round(v));
  });
  const fillType = o?.fillType;
  props.querySelectorAll<HTMLInputElement>('[data-prop="fillB"]').forEach((el) => (el.disabled = fillType === 'einfarbig' || fillType === 'regenbogen'));
  props.querySelectorAll<HTMLInputElement>('[data-prop="fillA"]').forEach((el) => (el.disabled = fillType === 'regenbogen'));
  document.querySelectorAll<HTMLSelectElement | HTMLInputElement>('[data-doc]').forEach((el) => {
    el.value = String(doc[el.dataset.doc as keyof Doc]);
  });
  (document.querySelector('[data-doc="bgColor"]') as HTMLInputElement).hidden = doc.background !== 'farbe';
  document.querySelectorAll<HTMLButtonElement>('#shapes button').forEach((b) => b.classList.toggle('on', b.dataset.shape === o?.shape));
}

function readInput(el: HTMLInputElement | HTMLSelectElement): unknown {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range') return Number(el.value) / Number(el.dataset.scale ?? 1);
  }
  return el.value;
}

let textTimer = 0;
props.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const o = selected();
  if (!o || !el.dataset.prop) return;
  (o as unknown as Record<string, unknown>)[el.dataset.prop] = readInput(el);
  renderOne(o);
  syncPanel();
  if (el.dataset.prop === 'text') { clearTimeout(textTimer); textTimer = window.setTimeout(commit, 700); }
});
props.addEventListener('change', () => { rememberStyle(); commit(); });

document.querySelectorAll<HTMLSelectElement | HTMLInputElement>('[data-doc]').forEach((el) => {
  el.addEventListener('input', () => {
    (doc as unknown as Record<string, unknown>)[el.dataset.doc!] = el.value;
    renderAll();
  });
  el.addEventListener('change', commit);
});

function rememberStyle() {
  const o = selected();
  if (!o) return;
  const { id, text, x, y, w, h, rotation, ...style } = o;
  void id; void text; void x; void y; void w; void h; void rotation;
  lastStyle = style;
}

// ---------- gallery & shapes ----------
function thumb(style: Style): string {
  const o: WordObj = { ...newObject(style, 'WordArt'), x: 150, y: 95, w: 230, h: 70, rotation: 0, outlineWidth: Math.min(style.outlineWidth, 4), depth: Math.round(style.depth / 2), shadowDist: style.shadowDist / 2 };
  if (o.shape === 'kreis') { o.w = 300; o.h = 42; }
  return `<svg viewBox="0 0 300 190" aria-hidden="true">${renderObject(o, 'th' + uid())}</svg>`;
}

function buildGallery() {
  $('presets').innerHTML = PRESETS.map((p) => `<button class="preset" data-preset="${p.id}" title="${p.label}">${thumb(p.style)}<span>${p.label}</span></button>`).join('');
  $('shapes').innerHTML = SHAPES.map((s) => `<button class="shape" data-shape="${s.id}" title="${s.label}"><svg viewBox="0 0 40 36" aria-hidden="true"><path d="${s.icon}"/></svg><span>${s.label}</span></button>`).join('');
}

$('presets').addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-preset]');
  if (!btn) return;
  const preset = PRESETS.find((p) => p.id === btn.dataset.preset)!;
  applyStyle(preset.style);
});

$('shapes').addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-shape]');
  const o = selected();
  if (!btn || !o) return;
  o.shape = btn.dataset.shape as WordObj['shape'];
  if (o.bend === 0) o.bend = 0.5;
  rememberStyle();
  renderAll();
  commit();
});

function applyStyle(style: Style) {
  lastStyle = clone(style);
  const o = selected();
  if (o) Object.assign(o, clone(style));
  else addObject();
  renderAll();
  commit();
}

// ---------- object commands ----------
function addObject() {
  const n = doc.objects.length;
  const word = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
  const o = newObject(lastStyle, word, {
    w: Math.min(700, 90 + word.length * 48), h: 110,
    x: CANVAS.w / 2 + ((n * 37) % 160) - 80, y: CANVAS.h / 2 + ((n * 53) % 180) - 90,
    rotation: 0,
  });
  doc.objects.push(o);
  selectedId = o.id;
  renderAll();
  commit();
}

function duplicate() {
  const o = selected();
  if (!o) return;
  const c = { ...clone(o), id: uid(), x: o.x + 30, y: o.y + 30 };
  doc.objects.push(c);
  selectedId = c.id;
  renderAll();
  commit();
}

function remove() {
  if (!selectedId) return;
  doc.objects = doc.objects.filter((o) => o.id !== selectedId);
  selectedId = doc.objects.at(-1)?.id ?? null;
  renderAll();
  commit();
}

function reorder(dir: 1 | -1) {
  const i = doc.objects.findIndex((o) => o.id === selectedId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= doc.objects.length) return;
  [doc.objects[i], doc.objects[j]] = [doc.objects[j], doc.objects[i]];
  renderAll();
  commit();
}

function surprise() {
  const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const style: Style = { ...clone(rnd(PRESETS).style) };
  style.shape = rnd(SHAPES).id;
  style.font = rnd(Object.keys(FONTS));
  style.bend = Math.round((Math.random() * 1.4 - 0.4) * 100) / 100;
  style.depth = 4 + Math.floor(Math.random() * 22);
  style.depthAngle = Math.floor(Math.random() * 72) * 5;
  applyStyle(style);
  const o = selected();
  if (o) { o.rotation = Math.floor(Math.random() * 19) - 9; renderAll(); commit(); }
}

function syncToolbar() {
  const has = !!selected();
  ($('dup') as HTMLButtonElement).disabled = !has;
  ($('del') as HTMLButtonElement).disabled = !has;
  ($('front') as HTMLButtonElement).disabled = !has;
  ($('back') as HTMLButtonElement).disabled = !has;
  ($('undo') as HTMLButtonElement).disabled = hIndex === 0;
  ($('redo') as HTMLButtonElement).disabled = hIndex >= history.length - 1;
}

$('add').onclick = addObject;
$('dup').onclick = duplicate;
$('del').onclick = remove;
$('undo').onclick = undo;
$('redo').onclick = redo;
$('front').onclick = () => reorder(1);
$('back').onclick = () => reorder(-1);
$('surprise').onclick = surprise;

// ---------- direct manipulation ----------
type Drag =
  | { mode: 'move'; o0: WordObj; p0: DOMPoint }
  | { mode: 'resize'; o0: WordObj; p0: DOMPoint; hx: number; hy: number; bw: number; bh: number }
  | { mode: 'rot'; o0: WordObj }
  | { mode: 'bend'; o0: WordObj; p0: DOMPoint };
let drag: Drag | null = null;

function svgPoint(e: PointerEvent | MouseEvent): DOMPoint {
  const pt = new DOMPoint(e.clientX, e.clientY);
  return pt.matrixTransform(svg.getScreenCTM()!.inverse());
}
function toLocal(p: DOMPoint, o: WordObj): DOMPoint {
  const a = (-o.rotation * Math.PI) / 180;
  const dx = p.x - o.x, dy = p.y - o.y;
  return new DOMPoint(dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a));
}

svg.addEventListener('pointerdown', (e) => {
  const target = e.target as Element;
  const p = svgPoint(e);
  const handle = target.closest<SVGElement>('[data-h]')?.dataset.h;
  const o = selected();

  if (handle && o) {
    const o0 = clone(o);
    if (handle === 'rot') drag = { mode: 'rot', o0 };
    else if (handle === 'bend') drag = { mode: 'bend', o0, p0: toLocal(p, o) };
    else {
      const b = content.querySelector<SVGRectElement>(`.obj[data-id="${o.id}"] .hit`)!.getBBox();
      drag = {
        mode: 'resize', o0, p0: toLocal(p, o), bw: b.width, bh: b.height,
        hx: handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0,
        hy: handle.includes('s') ? 1 : handle.startsWith('n') ? -1 : 0,
      };
    }
  } else {
    const hitObj = target.closest<SVGGElement>('.obj');
    if (hitObj) {
      selectedId = hitObj.dataset.id!;
      drag = { mode: 'move', o0: clone(selected()!), p0: p };
      renderOverlay();
      syncPanel();
      syncToolbar();
    } else {
      selectedId = null;
      renderOverlay();
      syncPanel();
      syncToolbar();
      return;
    }
  }
  svg.setPointerCapture(e.pointerId);
  e.preventDefault();
});

svg.addEventListener('pointermove', (e) => {
  const o = selected();
  if (!drag || !o) return;
  const p = svgPoint(e);
  const { o0 } = drag;

  if (drag.mode === 'move') {
    o.x = o0.x + p.x - drag.p0.x;
    o.y = o0.y + p.y - drag.p0.y;
    guide = null;
    if (!e.altKey) {
      const sx = Math.abs(o.x - CANVAS.w / 2) < 8, sy = Math.abs(o.y - CANVAS.h / 2) < 8;
      if (sx) o.x = CANVAS.w / 2;
      if (sy) o.y = CANVAS.h / 2;
      guide = sx && sy ? 'xy' : sx ? 'x' : sy ? 'y' : null;
    }
  } else if (drag.mode === 'rot') {
    let a = (Math.atan2(p.y - o0.y, p.x - o0.x) * 180) / Math.PI + 90;
    if (a > 180) a -= 360;
    o.rotation = e.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
  } else if (drag.mode === 'bend') {
    const pl = toLocal(p, o0);
    o.bend = Math.max(-1, Math.min(1, Math.round((o0.bend - (pl.y - drag.p0.y) / Math.max(o0.h * 1.5, 120)) * 100) / 100));
  } else {
    const pl = toLocal(p, o0);
    const { hx, hy, bw, bh } = drag;
    let fx = hx ? Math.max(40, bw + hx * (pl.x - drag.p0.x)) / bw : 1;
    let fy = hy ? Math.max(30, bh + hy * (pl.y - drag.p0.y)) / bh : 1;
    if (hx && hy && !e.shiftKey) fx = fy = Math.max(fx, fy); // corners: proportional unless Shift
    o.w = Math.max(40, o0.w * fx);
    o.h = Math.max(16, o0.h * fy);
    // keep the opposite edge where it was
    const lx = (hx * bw * (fx - 1)) / 2, ly = (hy * bh * (fy - 1)) / 2;
    const a = (o0.rotation * Math.PI) / 180;
    o.x = o0.x + lx * Math.cos(a) - ly * Math.sin(a);
    o.y = o0.y + lx * Math.sin(a) + ly * Math.cos(a);
  }
  renderOne(o);
  syncPanel();
});

function endDrag() {
  if (!drag) return;
  drag = null;
  guide = null;
  renderOverlay();
  commit();
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);

svg.addEventListener('dblclick', (e) => {
  if (!(e.target as Element).closest('.obj')) return;
  const input = $<HTMLInputElement>('text');
  input.focus();
  input.select();
});

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  const mod = e.ctrlKey || e.metaKey;
  if (typing) {
    if (e.key === 'Escape' || e.key === 'Enter') (e.target as HTMLElement).blur();
    return;
  }
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod) return;
  const o = selected();
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); remove(); }
  else if (k === 'escape') { selectedId = null; renderAll(); }
  else if (k === 'n') addObject();
  else if (k === 'r') surprise();
  else if (k === ']') reorder(1);
  else if (k === '[') reorder(-1);
  else if (k === 'enter' && o) { e.preventDefault(); $<HTMLInputElement>('text').focus(); }
  else if (k === 'tab' && doc.objects.length) {
    e.preventDefault();
    const i = doc.objects.findIndex((x) => x.id === selectedId);
    selectedId = doc.objects[(i + (e.shiftKey ? -1 : 1) + doc.objects.length) % doc.objects.length].id;
    renderAll();
  } else if (o && k.startsWith('arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    if (k === 'arrowleft') o.x -= step;
    if (k === 'arrowright') o.x += step;
    if (k === 'arrowup') o.y -= step;
    if (k === 'arrowdown') o.y += step;
    renderOne(o);
    clearTimeout(textTimer);
    textTimer = window.setTimeout(commit, 400);
  }
});

// ---------- export & Discord ----------
let toastTimer = 0;
function toast(msg: string, error = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', error);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3200);
}

async function exportPng() {
  try { download(await pngBlob(doc), 'wordart.png'); toast('PNG gespeichert.'); }
  catch (err) { toast(String((err as Error).message), true); }
}
$('save').onclick = exportPng;
$('svg').onclick = () => download(svgBlob(doc), 'wordart.svg');

$('share').onclick = async () => {
  const btn = $<HTMLButtonElement>('share');
  btn.disabled = true;
  btn.textContent = 'Wird hochgeladen…';
  try {
    await shareImage(await pngBlob(doc));
    showUser();
  } catch (err) {
    console.error(err);
    toast(`Teilen hat nicht geklappt: ${(err as Error).message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'In Discord teilen';
  }
};

function showUser() {
  if (!user) return;
  const who = $('who');
  who.hidden = false;
  who.textContent = `● ${user.global_name || user.username}`;
}

async function bootDiscord() {
  if (!inDiscord) return;
  $('mode').textContent = 'DISCORD WIRD VERBUNDEN…';
  try {
    await initDiscord();
    document.body.classList.add('in-discord');
    $('share').hidden = false;
    $('save').hidden = true; // downloads are blocked inside the Discord iframe
    $('svg').hidden = true;
    $('mode').textContent = 'DISCORD ACTIVITY';
  } catch (err) {
    console.error(err);
    $('mode').textContent = 'DISCORD NICHT VERBUNDEN';
    toast(`Discord-Verbindung fehlgeschlagen: ${(err as Error).message}`, true);
  }
}

// ---------- boot ----------
buildGallery();
renderAll();
new ResizeObserver(() => renderOverlay()).observe(svg);
bootDiscord();
