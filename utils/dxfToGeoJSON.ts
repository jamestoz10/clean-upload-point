import dxfParser from 'dxf-parser';
import proj4 from 'proj4';

const sourceProjection = "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs"; // <-- make sure this is correct for your DXF!
const targetProjection = "+proj=longlat +datum=WGS84 +no_defs";

const SEGMENTS_PER_ARC = 24; // tessellation density

function projectXY(x: number, y: number): [number, number] {
  try {
    const [lng, lat] = proj4(sourceProjection, targetProjection, [x, y]);
    return [lng, lat];
  } catch {
    // fall back: no reprojection
    return [x, y];
  }
}

function closeIfNeeded(coords: number[][]): number[][] {
  if (coords.length < 1) return coords;
  const [fx, fy] = coords[0];
  const [lx, ly] = coords[coords.length - 1];
  if (fx !== lx || fy !== ly) coords = [...coords, [fx, fy]];
  return coords;
}

// ---- bulge helpers (LWPOLYLINE arcs) ----
function tessellateBulge(p0: {x:number,y:number}, p1:{x:number,y:number}, bulge:number, segments=SEGMENTS_PER_ARC): Array<[number,number]> {
  // bulge b => central angle theta = 4*atan(b)
  const theta = 4 * Math.atan(bulge);
  if (Math.abs(bulge) < 1e-12 || Math.abs(theta) < 1e-9) return [[p1.x, p1.y]];
  // chord
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  // radius
  const r = chord / (2 * Math.sin(theta / 2));
  // midpoint of chord
  const mx = (p0.x + p1.x)/2, my = (p0.y + p1.y)/2;
  // angle of chord
  const alpha = Math.atan2(dy, dx);
  // distance from midpoint to center
  const h = r * Math.cos(theta/2);
  // determine sign (bulge sign gives arc side)
  const sign = Math.sign(bulge);
  // center
  const cx = mx - h * Math.sin(alpha) * sign;
  const cy = my + h * Math.cos(alpha) * sign;
  // start & end angles
  const a0 = Math.atan2(p0.y - cy, p0.x - cx);
  let a1 = Math.atan2(p1.y - cy, p1.x - cx);
  // ensure direction matches theta
  let sweep = a1 - a0;
  if (sign > 0 && sweep < 0) a1 += 2*Math.PI;
  if (sign < 0 && sweep > 0) a1 -= 2*Math.PI;

  const pts: Array<[number,number]> = [];
  for (let i=1; i<=segments; i++){
    const a = a0 + ( (a1 - a0) * i / segments );
    pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
  }
  return pts;
}

// ---- ARC/CIRCLE tessellation ----
function arcToCoords(cx:number, cy:number, r:number, start:number, end:number, segments=SEGMENTS_PER_ARC): [number,number][] {
  const coords: [number,number][] = [];
  const sweep = end - start;
  for (let i=0;i<=segments;i++){
    const a = start + sweep * (i/segments);
    coords.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]);
  }
  return coords;
}

export interface DXFEntity {
  type: string;
  vertices?: Array<{ x: number; y: number; z?: number; bulge?: number }>;
  vertexes?: Array<{ x: number; y: number; z?: number; bulge?: number }>;
  points?: Array<{ x: number; y: number; z?: number }>;
  start?: { x: number; y: number; z?: number };
  end?: { x: number; y: number; z?: number };
  startPoint?: { x: number; y: number; z?: number };
  endPoint?: { x: number; y: number; z?: number };
  center?: { x: number; y: number; z?: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  majorAxis?: { x: number; y: number };
  axisRatio?: number;
  closed?: boolean;
  shape?: boolean;
  flags?: number;
  flag?: number;
  layer?: string;
}

export interface DXFData {
  entities: DXFEntity[];
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "LineString" | "Polygon";
    coordinates: number[][] | number[][][];
  };
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export const convertDXFToGeoJSON = (dxfData: any): GeoJSONFeatureCollection => {
  const features: GeoJSONFeature[] = [];

  for (const e of dxfData.entities as any[]) {
    switch (e.type) {
      case 'LINE': {
        if (!e.start || !e.end) break;
        const c0 = projectXY(e.start.x, e.start.y);
        const c1 = projectXY(e.end.x, e.end.y);
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [c0, c1] },
          properties: { entityType: e.type, layer: e.layer }
        });
        break;
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const vs = e.vertices || e.vertexes || e.points;
        if (!vs || vs.length < 2) break;

        // build 2D coords honoring bulge
        const coords: [number,number][] = [];
        for (let i=0;i<vs.length;i++){
          const v0 = vs[i];
          const v1 = vs[(i+1) % vs.length];
          // push first vertex
          if (i===0) coords.push([v0.x, v0.y]);
          const bulge = (typeof v0.bulge === 'number') ? v0.bulge : 0;
          if ((e.closed || e.shape || (e.flags & 1) === 1 || e.flag === 1) && i === vs.length-1) {
            // closing segment handled by modulo above
          }
          if (bulge) {
            // append tessellated arc *excluding* v0, including intermediate to v1
            const arcPts = tessellateBulge(v0, v1, bulge);
            for (const [ax, ay] of arcPts) coords.push([ax, ay]);
          } else {
            // straight segment just ensures v1 at end when loop iterates
            coords.push([v1.x, v1.y]);
          }
        }

        const isClosed = !!(e.closed || e.shape || (e.flags & 1) === 1 || e.flag === 1);
        if (isClosed) {
          const ring = closeIfNeeded(coords.map(([x,y]) => projectXY(x,y)));
          // valid polygon ring needs >= 4 positions
          if (ring.length >= 4) {
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [ring] } as any,
              properties: { entityType: e.type, layer: e.layer, closed: true }
            });
            break;
          }
        }
        // fallback to LineString
        const line = coords.map(([x,y]) => projectXY(x,y));
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: line },
          properties: { entityType: e.type, layer: e.layer, closed: false }
        });
        break;
      }

      case 'ARC': {
        const c = e.center; if (!c) break;
        const r = e.radius; if (!r) break;
        // DXF angles are degrees, convert to radians
        const start = (e.startAngle ?? 0) * Math.PI/180;
        const end   = (e.endAngle   ?? 0) * Math.PI/180;
        const raw = arcToCoords(c.x, c.y, r, start, end);
        const coords = raw.map(([x,y]) => projectXY(x,y));
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { entityType: e.type, layer: e.layer }
        });
        break;
      }

      case 'CIRCLE': {
        const c = e.center; if (!c) break;
        const r = e.radius; if (!r) break;
        const raw = arcToCoords(c.x, c.y, r, 0, 2*Math.PI);
        const coords = closeIfNeeded(raw.map(([x,y]) => projectXY(x,y)));
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] } as any,
          properties: { entityType: e.type, layer: e.layer }
        });
        break;
      }

      case 'ELLIPSE': {
        // simple tessellation using parametric form
        const cx = e.center?.x, cy = e.center?.y;
        const rx = e.majorAxis?.x ?? 1, ry = e.majorAxis?.y ?? 0;
        const ratio = e.axisRatio ?? 1; // minor/major
        const start = (e.startAngle ?? 0);
        const end   = (e.endAngle ?? 2*Math.PI);
        const pts: [number,number][] = [];
        for (let i=0;i<=SEGMENTS_PER_ARC;i++){
          const t = start + (end-start) * (i/SEGMENTS_PER_ARC);
          const x = cx + rx*Math.cos(t) - (ry*ratio)*Math.sin(t);
          const y = cy + rx*Math.sin(t) + (ry*ratio)*Math.cos(t);
          pts.push([x,y]);
        }
        const coords = pts.map(([x,y]) => projectXY(x,y));
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { entityType: e.type, layer: e.layer }
        });
        break;
      }

      case 'SOLID': {
        // dxf-parser exposes points (3 or 4)
        const pts = e.points || e.vertices;
        if (!pts || pts.length < 3) break;
        const coords = pts.map((p:any) => projectXY(p.x, p.y));
        const ring = closeIfNeeded(coords);
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] } as any,
          properties: { entityType: e.type, layer: e.layer }
        });
        break;
      }

      // Intentionally ignoring MTEXT/TEXT/HATCH/INSERT here.
      default:
        // no-op
        break;
    }
  }

  return { type: 'FeatureCollection', features };
};

/**
 * Parses DXF file content and converts to GeoJSON
 * @param dxfContent - DXF file content as string
 * @returns GeoJSON FeatureCollection
 */
export const parseDXFToGeoJSON = (dxfContent: string): GeoJSONFeatureCollection => {
  try {
    const parser = new dxfParser();
    const dxfData = parser.parseSync(dxfContent);
    
    if (!dxfData) {
      throw new Error('DXF parser returned null - invalid or empty DXF file');
    }
    
    return convertDXFToGeoJSON(dxfData);
  } catch (error) {
    console.error('Error parsing DXF file:', error);
    throw new Error(`Failed to parse DXF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Converts DXF buffer to GeoJSON
 * @param dxfBuffer - DXF file buffer
 * @returns GeoJSON FeatureCollection
 */
export const convertDXFBufferToGeoJSON = (dxfBuffer: Buffer): GeoJSONFeatureCollection => {
  try {
    const dxfContent = dxfBuffer.toString('utf-8');
    return parseDXFToGeoJSON(dxfContent);
  } catch (error) {
    console.error('Error converting DXF buffer to GeoJSON:', error);
    throw new Error(`Failed to convert DXF buffer to GeoJSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};