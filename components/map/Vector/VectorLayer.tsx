'use client';

import { useEffect, useRef, useState } from 'react';

// Global layer tracking to prevent duplicates across component remounts
const globalLayersRef = { current: [] as any[] };

interface VectorLayerProps {
  map: any;
  vectorData?: any;
  L?: any;
}

export default function VectorLayer({ map, vectorData, L }: VectorLayerProps) {
  const layersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentGeoJsonData, setCurrentGeoJsonData] = useState<any>(null);

  const exportGeoJSON = () => {
    if (!currentGeoJsonData) return;
    
    const dataStr = JSON.stringify(currentGeoJsonData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `union-data-${new Date().toISOString().split('T')[0]}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!map || !vectorData || !L) return;
    
    // Additional check to ensure map is fully initialized
    if (!map.getMaxZoom || !map.getContainer || !map.getPane) {
      return;
    }

    const loadVectorData = async () => {
      try {
        setError(null);

        // Clean up previous layers
        globalLayersRef.current.forEach((layer) => {
          if (layer.transform && layer.transform._enabled) {
            layer.transform.disable();
          }
          if (layer.dragging && layer.dragging._enabled) {
            layer.dragging.disable();
          }
          layer.remove();
        });
        globalLayersRef.current = [];
        layersRef.current = [];

        // Use the processed GeoJSON data from useMapPageState
        const processedGeoJsonData = vectorData.geoJsonData;
        
        if (!processedGeoJsonData?.features?.length) {
          throw new Error('Invalid or empty GeoJSON');
        }

        // Create layers
        const layers: any[] = [];
        const renderer = L.svg();
        
        processedGeoJsonData.features.forEach((feature: any, index: number) => {
          const geometry = feature.geometry;
          if (!geometry?.coordinates) return;

          try {
            // Determine depth based on coordinate structure
            const getDepth = (coords: any): number => {
              if (!Array.isArray(coords)) return -1;
              if (coords.length === 2 && typeof coords[0] === 'number') return 0;
              if (Array.isArray(coords[0]) && coords[0].length === 2) return 0;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && coords[0][0].length === 2) return 1;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) return 2;
              return -1;
            };

            const depth = getDepth(geometry.coordinates);
            if (depth === -1) return;

            // Convert coordinates to LatLngs with proper structure
            let latlngs;
            if (geometry.type === 'MultiPolygon') {
              latlngs = geometry.coordinates.map((poly: any) => L.GeoJSON.coordsToLatLngs(poly[0]));
            } else if (geometry.type === 'Polygon') {
              latlngs = [L.GeoJSON.coordsToLatLngs(geometry.coordinates[0])];
            } else {
              latlngs = L.GeoJSON.coordsToLatLngs(geometry.coordinates, depth);
            }
            
            // Create layer
            const isLine = geometry.type.includes('Line');
            const color = ['#092', '#0066cc', '#cc6600'][(feature.properties?.z || 0) % 3];
            
            let layer;
            if (isLine) {
              layer = L.polyline(latlngs[0], { renderer, color, weight: 3, opacity: 0.9, transform: true, draggable: true }).addTo(map);
            } else {
              if (latlngs.length === 1) {
                layer = L.polygon(latlngs[0], { renderer, color, weight: 3, opacity: 0.9, fillOpacity: 0.3, transform: true, draggable: true }).addTo(map);
              } else {
                layer = L.polygon(latlngs, { renderer, color, weight: 3, opacity: 0.9, fillOpacity: 0.3, transform: true, draggable: true }).addTo(map);
              }
            }
            
            // Add CSS to prevent stroke scaling
            if (layer._path) {
              layer._path.style.vectorEffect = 'non-scaling-stroke';
            }
            
            // Enable transform handles
            if (layer.transform && !layer.transform._enabled) {
              layer.transform.enable();
              layer.transform.setOptions({ 
                rotation: true, 
                scaling: true,
                uniformScaling: true,
                strokeWidth: 3
              });
            }
            
            // Enable drag functionality using leaflet-path-drag
            console.log('Layer dragging property:', layer.dragging);
            if (layer.dragging && !layer.dragging._enabled) {
              layer.dragging.enable();
              console.log('Enabled dragging for layer');
            } else if (!layer.dragging) {
              console.warn('No dragging property found on layer - leaflet-path-drag may not be loaded');
            }
            
            layers.push(layer);
            layersRef.current.push(layer);
            globalLayersRef.current.push(layer);
          } catch (e) {
            console.error('Feature failed:', e);
          }
        });

        // Store the GeoJSON data for export
        setCurrentGeoJsonData(processedGeoJsonData);

        // Fit map to show all features
        if (layers.length > 0 && map && map.fitBounds) {
          try {
            const group = new L.FeatureGroup(layers);
            const bounds = group.getBounds();
            if (bounds && bounds.isValid && bounds.isValid()) {
              map.fitBounds(bounds.pad(0.1));
            }
          } catch (boundsError) {
            console.warn('Could not fit bounds:', boundsError);
          }
        }

      } catch (err: any) {
        setError(err?.message || 'Failed to load vector data');
      }
    };

    loadVectorData();

    return () => {
      layersRef.current.forEach(layer => layer.remove());
      layersRef.current = [];
    };
  }, [map, vectorData, L]);

  return (
    <div className="absolute top-4 right-4 z-[1001]">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 mb-4 max-w-sm">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">Vector Load Error</h4>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {currentGeoJsonData && (
          <button
            onClick={exportGeoJSON}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export</span>
          </button>
        )}
      </div>
  );
}



