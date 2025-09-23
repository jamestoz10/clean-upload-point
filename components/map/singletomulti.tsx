'use client';

/**
 * Converts separate LineStrings into a single MultiLineString
 * Converts separate Polygons into a single MultiPolygon
 * Converts closed LWPOLYLINEs to Polygons
 * Leaves other geometry types unchanged
 */
export function convertToMultiGeometry(geoJsonData: any): any {
  if (!geoJsonData || !geoJsonData.features || !Array.isArray(geoJsonData.features)) {
    return geoJsonData;
  }

  const convertedFeatures: any[] = [];
  const lineStringCoordinates: number[][][] = [];
  const polygonCoordinates: number[][][][] = [];
  const otherFeatures: any[] = [];
  
  // Tolerance for checking if a line is closed (in degrees)
  const CLOSURE_TOLERANCE = 1e-10;

  // Group features by geometry type
  geoJsonData.features.forEach((feature: any) => {
    if (!feature.geometry) {
      otherFeatures.push(feature);
      return;
    }

    const geometry = feature.geometry;

    switch (geometry.type) {
      case 'LineString':
        if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
          // Check if this LineString should be converted to a Polygon (closed LWPOLYLINE)
          if (isClosedLineString(geometry.coordinates, CLOSURE_TOLERANCE)) {
            // Convert closed LineString to Polygon
            const closedCoords = ensureRingClosure(geometry.coordinates);
            polygonCoordinates.push([closedCoords]);
          } else {
            lineStringCoordinates.push(geometry.coordinates);
          }
        }
        break;

      case 'Polygon':
        if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
          polygonCoordinates.push(geometry.coordinates);
        }
        break;

      case 'MultiLineString':
        // If it's already a MultiLineString, extract the individual LineStrings
        if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
          geometry.coordinates.forEach((lineString: number[][]) => {
            lineStringCoordinates.push(lineString);
          });
        }
        break;

      case 'MultiPolygon':
        // If it's already a MultiPolygon, extract the individual Polygons
        if (geometry.coordinates && Array.isArray(geometry.coordinates)) {
          geometry.coordinates.forEach((polygon: number[][][]) => {
            polygonCoordinates.push(polygon);
          });
        }
        break;

      default:
        // Keep other geometry types as-is
        otherFeatures.push(feature);
        break;
    }
  });

  // Create MultiLineString if we have LineStrings
  if (lineStringCoordinates.length > 0) {
    const multiLineStringFeature = {
      type: 'Feature',
      properties: {
        // Merge properties from all LineString features
        ...mergeProperties(geoJsonData.features.filter((f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString')),
        geometryType: 'MultiLineString',
        originalCount: lineStringCoordinates.length
      },
      geometry: {
        type: 'MultiLineString',
        coordinates: lineStringCoordinates
      }
    };
    convertedFeatures.push(multiLineStringFeature);
  }

  // Create MultiPolygon if we have Polygons
  if (polygonCoordinates.length > 0) {
    const multiPolygonFeature = {
      type: 'Feature',
      properties: {
        // Merge properties from all Polygon features
        ...mergeProperties(geoJsonData.features.filter((f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')),
        geometryType: 'MultiPolygon',
        originalCount: polygonCoordinates.length
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: polygonCoordinates
      }
    };
    convertedFeatures.push(multiPolygonFeature);
  }

  // Add other features (Point, MultiPoint, etc.)
  convertedFeatures.push(...otherFeatures);

  return {
    type: geoJsonData.type,
    features: convertedFeatures,
    crs: {
      type: "name",
      properties: {
        name: "urn:ogc:def:crs:OGC:1.3:CRS84"
      }
    },
    properties: {
      ...geoJsonData.properties,
      converted: true,
      originalFeatureCount: geoJsonData.features.length,
      convertedFeatureCount: convertedFeatures.length
    }
  };
}

/**
 * Merges properties from multiple features
 */
function mergeProperties(features: any[]): any {
  const mergedProperties: any = {};
  
  features.forEach(feature => {
    if (feature.properties) {
      Object.keys(feature.properties).forEach(key => {
        if (!mergedProperties[key]) {
          mergedProperties[key] = feature.properties[key];
        } else if (Array.isArray(mergedProperties[key])) {
          // If it's already an array, add to it
          if (Array.isArray(feature.properties[key])) {
            mergedProperties[key] = [...mergedProperties[key], ...feature.properties[key]];
          } else {
            mergedProperties[key] = [...mergedProperties[key], feature.properties[key]];
          }
        } else if (typeof mergedProperties[key] === 'string') {
          // If it's a string, convert to array
          mergedProperties[key] = [mergedProperties[key], feature.properties[key]];
        }
      });
    }
  });

  return mergedProperties;
}

/**
 * Utility function to check if conversion is needed
 */
export function needsConversion(geoJsonData: any): boolean {
  if (!geoJsonData || !geoJsonData.features) return false;

  let lineStringCount = 0;
  let polygonCount = 0;

  geoJsonData.features.forEach((feature: any) => {
    if (feature.geometry) {
      switch (feature.geometry.type) {
        case 'LineString':
        case 'MultiLineString':
          lineStringCount++;
          break;
        case 'Polygon':
        case 'MultiPolygon':
          polygonCount++;
          break;
      }
    }
  });

  // Conversion needed if we have multiple LineStrings or multiple Polygons
  return lineStringCount > 1 || polygonCount > 1;
}

/**
 * Utility function to get conversion summary
 */
export function getConversionSummary(originalData: any, convertedData: any): any {
  return {
    original: {
      featureCount: originalData.features?.length || 0,
      lineStringCount: originalData.features?.filter((f: any) => 
        f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      ).length || 0,
      polygonCount: originalData.features?.filter((f: any) => 
        f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
      ).length || 0
    },
    converted: {
      featureCount: convertedData.features?.length || 0,
      hasMultiLineString: convertedData.features?.some((f: any) => f.geometry?.type === 'MultiLineString') || false,
      hasMultiPolygon: convertedData.features?.some((f: any) => f.geometry?.type === 'MultiPolygon') || false
    }
  };
}

/**
 * Checks if a LineString is closed (first point equals last point within tolerance)
 */
function isClosedLineString(coordinates: number[][], tolerance: number): boolean {
  if (coordinates.length < 3) return false;
  
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  
  // Check if first and last points are the same within tolerance
  return Math.abs(first[0] - last[0]) < tolerance && 
         Math.abs(first[1] - last[1]) < tolerance;
}

/**
 * Ensures ring closure by appending the first point if needed
 */
function ensureRingClosure(coordinates: number[][]): number[][] {
  if (coordinates.length < 3) return coordinates;
  
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  
  // If already closed, return as-is
  if (first[0] === last[0] && first[1] === last[1]) {
    return coordinates;
  }
  
  // Append first point to close the ring
  return [...coordinates, first];
}
