import {
  featureCollection,
  difference,
  area,
  booleanDisjoint,
  bbox as turfBBox,
  cleanCoords,
  rewind,
} from '@turf/turf';

type FC = any; // FeatureCollection<Polygon|MultiPolygon>
const EPS = 1e-8;
const isPoly = (f:any) => f?.type === 'Feature' && /Polygon$/.test(f?.geometry?.type);

const prep = (f:any) => {
  // Clean ring order + duplicate coords to reduce boolean-op errors
  try { return cleanCoords(rewind(f, { reverse: true })); } catch { return f; }
};

const bboxesDisjoint = (a:number[], b:number[]) =>
  b[0] > a[2] || b[2] < a[0] || b[1] > a[3] || b[3] < a[1];

/**
 * Drop polygons if they are covered by polygons above them by ≥ minCoveredPct.
 * If kept, you can keep the clipped visible remainder or the original shape.
 */
export function keepTopVisible(
  fc: FC,
  {
    orderBy = 'z',        // higher value = drawn on top
    minCoveredPct = 70,   // drop if ≥ this % is covered (0..100)
    clipRemainder = true  // keep only the visible piece when not dropped
  }: {
    orderBy?: string;
    minCoveredPct?: number;
    clipRemainder?: boolean;
  } = {}
): FC {
  // sort top -> bottom
  const feats = fc.features
    .filter(isPoly)
    .sort((a:any,b:any) => (b.properties?.[orderBy] ?? 0) - (a.properties?.[orderBy] ?? 0));

  console.log(`Processing ${feats.length} polygon features`);
  console.log('Geometry types:', feats.map((f: any) => f.geometry.type));

  const out:any[] = [];
  const top:any[] = [];
  const topBBoxes:number[][] = [];

  for (const orig of feats) {
    const f = prep(orig);
    const A = Math.max(area(f), EPS);
    const fb = turfBBox(f);

    let visible:any = f;

    // subtract against everything already on top
    for (let i = 0; i < top.length; i++) {
      const t = top[i];
      const tb = topBBoxes[i];

      // cheap skips
      if (bboxesDisjoint(fb, tb)) continue;
      if (booleanDisjoint(visible, t)) continue;

      // guarded difference (may return null if fully covered)
      let next:any;
      try {
        next = difference(featureCollection([visible, t]));
      } catch {
        // if a boolean op fails, keep current 'visible' rather than crashing
        continue;
      }
      if (!next) { visible = null; break; }
      visible = next;

      // early-exit once threshold reached
      const coveredPct = (1 - area(visible) / A) * 100;
      if (coveredPct >= minCoveredPct) { visible = null; break; }
    }

    if (visible) {
      out.push(
        clipRemainder
          ? { ...visible, properties: { ...orig.properties } }
          : orig
      );
    } // else dropped

    // add original to the "already on top" stack
    top.push(f);
    topBBoxes.push(turfBBox(f));
  }

  return featureCollection(out);
}

/**
 * Adds z-index properties to features based on their array order (first = top)
 * @param features Array of GeoJSON features
 * @param startZ Starting z-index value (default: features.length)
 * @returns Features with z-index properties
 */
export function addZIndexToFeatures(
  features: any[],
  startZ: number = features.length
): any[] {
  return features.map((feature, index) => ({
    ...feature,
    properties: {
      ...feature.properties,
      z: startZ - index // Higher z = in front
    }
  }));
}

/**
 * Processes overlapping polygons to show only visible parts
 * @param geoJsonData GeoJSON data with potentially overlapping polygons
 * @param options Configuration options
 * @returns Processed GeoJSON with only visible parts
 */
export function processOverlappingPolygons(
  geoJsonData: any,
  options: { orderBy?: string; minCoveredPct?: number; clipRemainder?: boolean } = {}
): any {
  if (!geoJsonData?.features?.length) {
    return geoJsonData;
  }

  // Filter to only polygon features
  const polygonFeatures = geoJsonData.features.filter(
    (feature: any) => 
      feature.geometry?.type === 'Polygon' || 
      feature.geometry?.type === 'MultiPolygon'
  );

  console.log(`Found ${polygonFeatures.length} polygon features to process`);

  if (polygonFeatures.length === 0) {
    return geoJsonData;
  }

  // Add z-index if not present
  const featuresWithZ = polygonFeatures.some((f: any) => f.properties?.z !== undefined)
    ? polygonFeatures
    : addZIndexToFeatures(polygonFeatures);

  console.log('Features with z-index:', featuresWithZ.map((f: any) => f.properties?.z));
  console.log('Processing with minCoveredPct:', options.minCoveredPct || 70);

  // Create feature collection for processing
  const fc = featureCollection(featuresWithZ);

  // Process overlapping polygons
  const visibleFeatures = keepTopVisible(fc, options);

  console.log(`Processed ${visibleFeatures.features.length} visible features`);

  // Return only processed polygon features (remove LineString features)
  return {
    ...geoJsonData,
    features: visibleFeatures.features // Only keep processed polygon features
  };
}
