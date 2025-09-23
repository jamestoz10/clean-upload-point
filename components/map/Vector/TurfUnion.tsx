'use client';

import { useEffect, useRef, useState } from 'react';
import { union, featureCollection } from '@turf/turf';

interface TurfUnionProps {
  map: any;
  L: any;
  processedGeoJsonData?: any; // GeoJSON data after polygon visibility processing
  onUnionComplete?: (unionResult: any) => void;
}

export default function TurfUnion({ map, L, processedGeoJsonData, onUnionComplete }: TurfUnionProps) {
  const unionLayerRef = useRef<any>(null);
  const [unionResult, setUnionResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !L || !processedGeoJsonData) return;

    const performUnion = async () => {
      try {
        setIsProcessing(true);
        setError(null);

        // Remove previous union layer
        if (unionLayerRef.current?.remove) {
          unionLayerRef.current.remove();
          unionLayerRef.current = null;
        }

        // Extract polygon features from processed data
        const polygonFeatures = processedGeoJsonData.features.filter((feature: any) => 
          feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
        );

        if (polygonFeatures.length === 0) {
          throw new Error('No polygon features found to union');
        }

        console.log(`Unioning ${polygonFeatures.length} polygon features`);

        // Perform union operation
        let result;
        if (polygonFeatures.length === 1) {
          // Single feature - no union needed, just use the feature
          result = polygonFeatures[0];
        } else {
          // Multiple features - perform union
          result = union(featureCollection(polygonFeatures));
          
          if (!result) {
            throw new Error('Union operation failed - no result returned');
          }
        }

        console.log('Union result:', result);

        // Create Leaflet layer from union result
        const unionLayer = L.geoJSON(result, {
          style: {
            color: '#ff0000',
            weight: 4,
            opacity: 0.8,
            fillColor: '#ff0000',
            fillOpacity: 0.2,
            dashArray: '10, 5'
          }
        });

        // Add to map
        unionLayer.addTo(map);
        unionLayerRef.current = unionLayer;

        // Store result
        setUnionResult(result);

        // Notify parent component
        if (onUnionComplete) {
          onUnionComplete(result);
        }

        // Fit map to show union result
        try {
          const bounds = unionLayer.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
          }
        } catch (boundsError) {
          console.warn('Could not fit bounds for union result:', boundsError);
        }

      } catch (err: any) {
        console.error('Error performing union:', err);
        setError(err?.message || 'Failed to union polygons');
      } finally {
        setIsProcessing(false);
      }
    };

    performUnion();

    // Cleanup function
    return () => {
      if (unionLayerRef.current?.remove) {
        unionLayerRef.current.remove();
        unionLayerRef.current = null;
      }
    };
  }, [map, L, processedGeoJsonData, onUnionComplete]);

  return (
    <div className="absolute top-4 left-4 z-[1002]">
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-sm text-blue-600">Unioning polygons...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-3 mb-2 max-w-sm">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="text-xs font-medium text-red-800">Union Error</h4>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {unionResult && !isProcessing && (
        <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-3">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-600">Union complete</span>
          </div>
        </div>
      )}
    </div>
  );
}
