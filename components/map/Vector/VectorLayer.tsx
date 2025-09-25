'use client';

import { useEffect, useRef, useState } from 'react';
import HandlesToggle from './HandlesToggle';
import PolygonSelector from './PolygonSelector';

// Global layer tracking to prevent duplicates across component remounts
const globalLayersRef = { current: [] as any[] };

interface VectorLayerProps {
  map: any;
  vectorData?: any;
  L?: any;
  combinedLineData?: any; // Combined MultiLineString data from LineCombiner
  cleanedData?: any; // Cleaned MultiLineString data with turf.cleanCoords applied
}

export default function VectorLayer({ map, vectorData, L, combinedLineData, cleanedData }: VectorLayerProps) {
  console.log('=== VectorLayer RENDER ===');
  console.log('VectorLayer component rendered with props:', {
    hasMap: !!map,
    hasL: !!L,
    hasVectorData: !!vectorData,
    hasCombinedLineData: !!combinedLineData,
    hasCleanedData: !!cleanedData,
    cleanedDataFeatures: cleanedData?.features?.length,
    vectorQualitySelection: typeof window !== 'undefined' ? localStorage.getItem('vector-quality-selection') : 'N/A'
  });
  const layersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentGeoJsonData, setCurrentGeoJsonData] = useState<any>(null);
  const [isHandlesLocked, setIsHandlesLocked] = useState<boolean>(false);
  const [flattenedLayers, setFlattenedLayers] = useState<any[]>([]);

  const handleHandlesToggle = (showHandles: boolean) => {
    setIsHandlesLocked(!showHandles);
  };

  const handleFlatten = (newFlattenedLayers: any[]) => {
    console.log('VectorLayer received flattened layers:', newFlattenedLayers.length);
    setFlattenedLayers(newFlattenedLayers);
    // Update layersRef to point to flattened layers
    layersRef.current = newFlattenedLayers;
  };

  const handleUnion = (unionLayer: any) => {
    setFlattenedLayers([]);
    // Update layersRef to point to unioned layer
    layersRef.current = [unionLayer];
  };

  const exportGeoJSON = () => {
    console.log('Export function called:', {
      hasCurrentGeoJsonData: !!currentGeoJsonData,
      layersCount: layersRef.current.length,
      hasCleanedData: !!cleanedData,
      hasVectorData: !!vectorData
    });
    
    // Prioritize cleanedData over currentGeoJsonData for line-only processing
    const dataToExport = cleanedData || currentGeoJsonData;
    
    console.log('Export data check:', {
      hasCurrentGeoJsonData: !!currentGeoJsonData,
      hasCleanedData: !!cleanedData,
      currentGeoJsonDataFeatures: currentGeoJsonData?.features?.length,
      cleanedDataFeatures: cleanedData?.features?.length,
      dataToExportFeatures: dataToExport?.features?.length,
      dataToExportType: dataToExport?.type
    });
    
    if (!dataToExport) {
      console.warn('No GeoJSON data available for export');
      return;
    }
    
    if (!layersRef.current.length) {
      console.warn('No layers available for export, but data exists. Attempting to export original data...', {
        hasDataToExport: !!dataToExport,
        layersCount: layersRef.current.length,
        usingCleanedData: !currentGeoJsonData && !!cleanedData
      });
      
      // Export the original data without layer transformations
      try {
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `exported-geojson-${new Date().toISOString().split('T')[0]}.geojson`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('GeoJSON exported successfully (original data, no transformations)');
        return;
      } catch (error) {
        console.error('Error exporting original GeoJSON:', error);
        return;
      }
    }
    
    try {
      // Create a new GeoJSON with current layer positions/transformations
      const updatedGeoJsonData = {
        type: 'FeatureCollection',
        features: layersRef.current.map((layer, index) => {
          try {
            // Get the current geometry from the layer
            let geometry;
            
            if (layer instanceof L.Polygon) {
              const latlngs = layer.getLatLngs();
              if (Array.isArray(latlngs[0])) {
                // MultiPolygon case
                geometry = {
                  type: 'MultiPolygon',
                  coordinates: latlngs.map((polygon: any) => 
                    [polygon.map((latlng: any) => [latlng.lng, latlng.lat])]
                  )
                };
              } else {
                // Single Polygon case
                geometry = {
                  type: 'Polygon',
                  coordinates: [latlngs.map((latlng: any) => [latlng.lng, latlng.lat])]
                };
              }
            } else if (layer instanceof L.Polyline) {
              const latlngs = layer.getLatLngs();
              geometry = {
                type: 'LineString',
                coordinates: latlngs.map((latlng: any) => [latlng.lng, latlng.lat])
              };
            } else {
              // Fallback to original geometry if layer type is unknown
              const originalFeature = dataToExport.features[index];
              geometry = originalFeature?.geometry || { type: 'Polygon', coordinates: [] };
            }
            
            // Preserve original properties or create new ones
            const originalFeature = dataToExport.features[index];
            const properties = originalFeature?.properties || {};
            
            return {
              type: 'Feature',
              geometry,
              properties: {
                ...properties,
                exportedAt: new Date().toISOString(),
                layerIndex: index,
                exportedFrom: 'map-current-state'
              }
            };
          } catch (error) {
            console.error(`Error processing layer ${index}:`, error);
            // Return original feature as fallback
            const originalFeature = dataToExport.features[index];
            return {
              ...originalFeature,
              properties: {
                ...originalFeature?.properties,
                exportedAt: new Date().toISOString(),
                layerIndex: index,
                exportedFrom: 'original-data-fallback',
                exportError: 'Layer processing failed'
              }
            };
          }
        })
      };
      
      const dataStr = JSON.stringify(updatedGeoJsonData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `exported-geojson-${new Date().toISOString().split('T')[0]}.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('GeoJSON exported successfully with current layer positions');
    } catch (error) {
      console.error('Error exporting GeoJSON:', error);
      setError('Failed to export GeoJSON data');
    }
  };

  useEffect(() => {
    console.log('=== VectorLayer useEffect START ===');
    console.log('useEffect dependencies:', { map: !!map, L: !!L, vectorData: !!vectorData, combinedLineData: !!combinedLineData, cleanedData: !!cleanedData });
    console.log('VectorLayer useEffect called:', {
      hasMap: !!map,
      hasL: !!L,
      hasVectorData: !!vectorData,
      hasCleanedData: !!cleanedData,
      mapReady: map?.getMaxZoom && map?.getContainer && map?.getPane
    });
    
    if (!map || !L) {
      console.log('VectorLayer useEffect: map or L not available, returning');
      return;
    }
    
    if (!vectorData && !cleanedData) {
      console.log('VectorLayer useEffect: no vectorData or cleanedData, returning');
      return;
    }
    
    console.log('VectorLayer useEffect triggered:', {
      hasMap: !!map,
      hasL: !!L,
      hasVectorData: !!vectorData,
      hasCleanedData: !!cleanedData
    });
    
    // Additional check to ensure map is fully initialized
    if (!map.getMaxZoom || !map.getContainer || !map.getPane) {
      console.log('VectorLayer useEffect: map not fully initialized, returning');
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

        // Use the cleaned data if available, otherwise fall back to combined or vector data
        const processedGeoJsonData = cleanedData || vectorData?.geoJsonData;
        
        // If we have cleanedData, clear any old layers and data to force re-processing
        if (cleanedData && currentGeoJsonData) {
          console.log('Clearing old data to use cleanedData');
          setCurrentGeoJsonData(null);
          // Clear old layers
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
        }
        
        console.log('VectorLayer data check:', {
          hasCleanedData: !!cleanedData,
          hasVectorData: !!vectorData,
          processedDataFeatures: processedGeoJsonData?.features?.length,
          vectorQualitySelection: typeof window !== 'undefined' ? localStorage.getItem('vector-quality-selection') : 'N/A'
        });
        
        if (!processedGeoJsonData?.features?.length) {
          throw new Error('Invalid or empty GeoJSON');
        }

        // Create layers
        const layers: any[] = [];
        const renderer = L.svg();
        
        console.log('Creating layers from processedGeoJsonData:', {
          featuresCount: processedGeoJsonData.features.length,
          sampleFeature: processedGeoJsonData.features[0]
        });
        
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

            // Convert coordinates to LatLngs with proper structure and validate
            let latlngs;
            if (geometry.type === 'MultiPolygon') {
              latlngs = geometry.coordinates.map((poly: any) => L.GeoJSON.coordsToLatLngs(poly[0]));
            } else if (geometry.type === 'Polygon') {
              latlngs = [L.GeoJSON.coordsToLatLngs(geometry.coordinates[0])];
            } else if (geometry.type === 'MultiLineString') {
              // For MultiLineString, clean and validate before creating layers
              console.log(`Processing MultiLineString with ${geometry.coordinates.length} line segments`);
              console.log('Sample coordinates:', geometry.coordinates[0]?.slice(0, 3));
              
              // Clean MultiLineString coordinates
              const cleanedCoordinates = geometry.coordinates
                .filter((line: any) => {
                  // Filter out invalid lines
                  if (!line || !Array.isArray(line) || line.length === 0) return false;
                  
                  // Check for valid coordinates
                  const validCoords = line.filter((coord: any) => 
                    Array.isArray(coord) && coord.length >= 2 && 
                    typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
                    !isNaN(coord[0]) && !isNaN(coord[1]) &&
                    isFinite(coord[0]) && isFinite(coord[1])
                  );
                  
                  // Drop parts with < 2 unique vertices (zero-length)
                  if (validCoords.length < 2) return false;
                  
                  // De-dupe consecutive duplicate vertices
                  const dedupedCoords = validCoords.filter((coord: any, index: number) => {
                    if (index === 0) return true;
                    const prevCoord = validCoords[index - 1];
                    return coord[0] !== prevCoord[0] || coord[1] !== prevCoord[1];
                  });
                  
                  // Drop parts with < 2 unique vertices after deduplication
                  if (dedupedCoords.length < 2) return false;
                  
                  // Optionally drop parts whose extent is below tiny epsilon
                  const xs = dedupedCoords.map((c: any) => c[0]);
                  const ys = dedupedCoords.map((c: any) => c[1]);
                  const extentX = Math.max(...xs) - Math.min(...xs);
                  const extentY = Math.max(...ys) - Math.min(...ys);
                  const epsilon = 1e-10;
                  
                  if (extentX < epsilon && extentY < epsilon) return false;
                  
                  return true;
                })
                .map((line: any) => {
                  // Apply the same cleaning to each line
                  const validCoords = line.filter((coord: any) => 
                    Array.isArray(coord) && coord.length >= 2 && 
                    typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
                    !isNaN(coord[0]) && !isNaN(coord[1]) &&
                    isFinite(coord[0]) && isFinite(coord[1])
                  );
                  
                  // De-dupe consecutive duplicate vertices
                  return validCoords.filter((coord: any, index: number) => {
                    if (index === 0) return true;
                    const prevCoord = validCoords[index - 1];
                    return coord[0] !== prevCoord[0] || coord[1] !== prevCoord[1];
                  });
                });
              
              console.log(`Cleaned from ${geometry.coordinates.length} to ${cleanedCoordinates.length} valid line segments`);
              
              if (cleanedCoordinates.length === 0) {
                console.warn('No valid coordinates found for MultiLineString after cleaning, skipping feature');
                return;
              }
              
              latlngs = cleanedCoordinates.map((line: any) => L.GeoJSON.coordsToLatLngs(line));
            } else {
              latlngs = L.GeoJSON.coordsToLatLngs(geometry.coordinates, depth);
            }
            
            // Create layer
            const isLine = geometry.type.includes('Line');
            const color = ['#092', '#0066cc', '#cc6600'][(feature.properties?.z || 0) % 3];
            
            let layer;
            if (isLine) {
              if (geometry.type === 'MultiLineString') {
                // For MultiLineString, create a single polyline with multiple line segments
                layer = L.polyline(latlngs, { renderer, color, weight: 3, opacity: 0.9, transform: true, draggable: true }).addTo(map);
              } else {
                // For single LineString
                layer = L.polyline(latlngs[0], { renderer, color, weight: 3, opacity: 0.9, transform: true, draggable: true }).addTo(map);
              }
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
            
            // Enable transform handles (following the example pattern)
            if (layer.transform) {
              // Set options first, then enable (like the example)
              layer.transform.setOptions({ 
                rotation: true, 
                scaling: true,
                uniformScaling: true,
                strokeWidth: 3
              });
              
              // Use requestAnimFrame to ensure proper timing (like the example)
              if (L.Util && L.Util.requestAnimFrame) {
                L.Util.requestAnimFrame(() => {
                  if (!layer.transform._enabled) {
                    layer.transform.enable();
                  }
                });
              } else {
                // Fallback if requestAnimFrame is not available
                if (!layer.transform._enabled) {
                  layer.transform.enable();
                }
              }
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
            
            console.log(`Created layer ${index}:`, {
              type: geometry.type,
              layerType: layer.constructor.name,
              coordinatesLength: geometry.coordinates?.length
            });
          } catch (e) {
            console.error('Feature failed:', e);
          }
        });

        // Store the GeoJSON data for export
        setCurrentGeoJsonData(processedGeoJsonData);
        
        console.log('Layer creation complete:', {
          totalLayers: layers.length,
          layersRefLength: layersRef.current.length,
          globalLayersLength: globalLayersRef.current.length
        });

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
  }, [map, vectorData, L, combinedLineData, cleanedData]);

  return (
    <>
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
          <div className="flex flex-col space-y-2">
            <button
              onClick={exportGeoJSON}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export</span>
            </button>
            
            <HandlesToggle 
              layers={layersRef.current} 
              onToggle={handleHandlesToggle}
              onFlatten={handleFlatten}
              onUnion={handleUnion}
            />
          </div>
        )}
      </div>
      
      <PolygonSelector 
        map={map} 
        L={L} 
        layers={flattenedLayers.length > 0 ? flattenedLayers : layersRef.current} 
        isActive={isHandlesLocked} 
      />
    </>
  );
}



