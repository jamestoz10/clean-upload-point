'use client';

import { useEffect, useRef, useState } from 'react';
import { flatten, featureCollection } from '@turf/turf';

interface TurfFlattenProps {
  map: any;
  L: any;
  unionedGeoJsonData?: any; // GeoJSON data after union operation
  onFlattenComplete?: (flattenedResult: any) => void;
}

export default function TurfFlatten({ map, L, unionedGeoJsonData, onFlattenComplete }: TurfFlattenProps) {
  const flattenedLayerRef = useRef<any>(null);
  const [flattenedResult, setFlattenedResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!map || !L || !unionedGeoJsonData) return;

    const performFlatten = async () => {
      try {
        setIsProcessing(true);
        setError(null);

        // Remove previous flattened layer
        if (flattenedLayerRef.current?.remove) {
          flattenedLayerRef.current.remove();
          flattenedLayerRef.current = null;
        }

        // Extract features from unioned data
        const features = unionedGeoJsonData.features || [];

        if (features.length === 0) {
          throw new Error('No features found to flatten');
        }

        console.log(`Flattening ${features.length} unioned features`);

        // Flatten the unioned polygon using Turf.js
        const flattened = flatten(featureCollection(features));

        if (!flattened || !flattened.features || flattened.features.length === 0) {
          throw new Error('Flatten operation failed - no result returned');
        }

        console.log('Flattened result:', flattened);
        console.log(`Flattened to ${flattened.features.length} individual polygons`);

        // Create Leaflet layer from flattened result
        // Create flattened layer for display (but don't add to map)
        const flattenedLayer = L.geoJSON(flattened, {
          style: {
            color: '#00ff00',
            weight: 2,
            opacity: 0.8,
            fillColor: '#00ff00',
            fillOpacity: 0.1,
            dashArray: '5, 5'
          }
        });

        // Don't add to map - just store the result
        flattenedLayerRef.current = flattenedLayer;

        // Store result
        setFlattenedResult(flattened);

        // Notify parent component
        if (onFlattenComplete) {
          onFlattenComplete(flattened);
        }

        // Fit map to show flattened result
        try {
          const bounds = flattenedLayer.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
          }
        } catch (boundsError) {
          console.warn('Could not fit bounds for flattened result:', boundsError);
        }

      } catch (err: any) {
        console.error('Error performing flatten:', err);
        setError(err?.message || 'Failed to flatten polygons');
      } finally {
        setIsProcessing(false);
      }
    };

    performFlatten();

    // Cleanup function
    return () => {
      if (flattenedLayerRef.current?.remove) {
        flattenedLayerRef.current.remove();
        flattenedLayerRef.current = null;
      }
    };
  }, [map, L, unionedGeoJsonData, onFlattenComplete]);

  return (
    <div className="absolute top-4 right-4 z-[1003]">
      {isProcessing && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg shadow-lg p-3 mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <span className="text-sm text-purple-600">Flattening polygons...</span>
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
              <h4 className="text-xs font-medium text-red-800">Flatten Error</h4>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

