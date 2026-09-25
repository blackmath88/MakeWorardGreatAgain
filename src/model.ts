export type ShapeId =
  | 'gerade' | 'bogen' | 'welle' | 'flagge' | 'steigung'
  | 'kreis' | 'woelbung' | 'taille' | 'perspektive' | 'spitze';

export type FillType = 'verlauf' | 'chrom' | 'regenbogen' | 'einfarbig';

export type BackgroundId = 'papier' | 'raster' | 'transparent' | 'farbe' | 'himmel';

export interface WordObj {
  id: string;
  text: string;
  font: string;
  shape: ShapeId;
  bend: number;        // -1 … 1, shape intensity (yellow diamond)
  x: number; y: number; // centre in canvas units
  w: number; h: number; // text box width / letter height
  rotation: number;     // degrees
  tracking: number;     // font units
  fillType: FillType;
  fillA: string; fillB: string;
  fillAngle: number;    // degrees, 90 = top → bottom
  outline: string;
  outlineWidth: number;
  depth: number;        // extrusion steps
  depthAngle: number;   // degrees, 45 = down-right
  depthColor: string;
  shadow: boolean;
  shadowColor: string;
  shadowDist: number;
}

export interface Doc {
  objects: WordObj[];
  background: BackgroundId;
  bgColor: string;
}

export const CANVAS = { w: 1000, h: 600 };

export type StyleKeys =
  | 'font' | 'shape' | 'bend' | 'tracking' | 'fillType' | 'fillA' | 'fillB' | 'fillAngle'
  | 'outline' | 'outlineWidth' | 'depth' | 'depthAngle' | 'depthColor'
  | 'shadow' | 'shadowColor' | 'shadowDist';

export type Style = Pick<WordObj, StyleKeys>;

let counter = 0;
export const uid = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newObject(style: Style, text = 'MAKE IT LOUD', at?: Partial<WordObj>): WordObj {
  return {
    id: uid(), text, x: CANVAS.w / 2, y: CANVAS.h / 2, w: 760, h: 150, rotation: -4,
    ...style, ...at,
  };
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
