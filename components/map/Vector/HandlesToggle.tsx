'use client';

import { useState, useEffect } from 'react';

interface HandlesToggleProps {
  layers: any[];
  map?: any;
  L?: any;
  isSelectionMode?: boolean;
  onToggle?: (showHandles: boolean) => void;
  onFlatten?: (flattenedLayers: any[]) => void;
  onUnion?: (unionLayer: any) => void;
}

export default function HandlesToggle({ layers, map, L, isSelectionMode, onToggle, onFlatten, onUnion }: HandlesToggleProps) {
  // Controls both transform handles and dragging functionality
  const [showTransformHandles, setShowTransformHandles] = useState<boolean>(true);
  const [originalLayers, setOriginalLayers] = useState<any[]>([]);
  const [flattenedLayers, setFlattenedLayers] = useState<any[]>([]);
  const [originalGeometry, setOriginalGeometry] = useState<any>(null);

  // Clear internal state when layers prop changes (e.g., after union operation)
  useEffect(() => {
    console.log('HandlesToggle: layers prop changed, clearing internal state');
    setOriginalLayers([]);
    setFlattenedLayers([]);
    setOriginalGeometry(null);
  }, [layers]);

  const toggleTransformHandles = async () => {
    const newState = !showTransformHandles;
    setShowTransformHandles(newState);
    
    if (newState) {
      // Unlocking - Union flattened layers back into multipolygon and enable handles
      await unionLayers();
    } else {
      // Locking - Disable handles on original layers and flatten multipolygon
      await disableHandlesAndFlatten();
    }

    // Notify parent component of state change
    if (onToggle) {
      onToggle(newState);
    }
  };

  const disableHandlesAndFlatten = async () => {
    try {
      console.log('Disabling handles and flattening, current layers:', layers.length);
      
      // First disable handles and dragging on original layers
      layers.forEach((layer, index) => {
        console.log(`Processing layer ${index}:`, layer);
        
        // Disable transform handles
        if (layer.transform && layer.transform._enabled) {
          layer.transform.disable();
          console.log(`Disabled transform handles on layer ${index}`);
        }
        
        // Disable dragging
        if (layer.dragging && layer.dragging._enabled) {
          layer.dragging.disable();
          console.log(`Disabled dragging on layer ${index}`);
        }
      });

      // Then flatten the layers
      await flattenLayers();
      
    } catch (error) {
      console.error('Error disabling handles and flattening:', error);
    }
  };

  const flattenLayers = async () => {
    try {
      // Work directly with current layers prop, don't store in state
      console.log('Flattening current layers:', layers.length);
      
      // Store the original geometry for restoration later
      const originalGeoJsonData = layers[0]?.feature || layers[0]?.toGeoJSON?.();
      if (originalGeoJsonData) {
        setOriginalGeometry(originalGeoJsonData);
        console.log('Stored original geometry:', originalGeoJsonData);
      }
      
      // Create individual polygon layers from multipolygon BEFORE removing original layers
      const newFlattenedLayers: any[] = [];
      
      layers.forEach((originalLayer) => {
        let latlngs;
        
        // Handle different layer types
        if (originalLayer.getLatLngs) {
          // Regular polygon/polyline layer
          latlngs = originalLayer.getLatLngs();
        } else if (originalLayer.eachLayer) {
          // GeoJSON layer - extract polygons from it
          const polygons: any[] = [];
          originalLayer.eachLayer((layer: any) => {
            if (layer.getLatLngs) {
              polygons.push(layer.getLatLngs());
            }
          });
          latlngs = polygons;
        } else {
          console.warn('Unknown layer type, skipping:', originalLayer);
          return;
        }
        
        if (Array.isArray(latlngs[0])) {
          // MultiPolygon case - create individual polygons
          latlngs.forEach((polygonCoords: any, index: number) => {
            if (map && L) {
              const individualPolygon = L.polygon(polygonCoords, {
                color: '#0066cc',  // Same blue color for all individual polygons
                weight: 2,
                opacity: 1.0,
                fillOpacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
                transform: false,  // No transform handles on individual polygons
                draggable: false   // No dragging on individual polygons
              }).addTo(map);
              
              // Add CSS for crisp rendering
              if (individualPolygon._path) {
                individualPolygon._path.style.vectorEffect = 'non-scaling-stroke';
                individualPolygon._path.style.shapeRendering = 'geometricPrecision';
                individualPolygon._path.style.imageRendering = 'crisp-edges';
              }
              
              // Do NOT enable transform handles or dragging on individual polygons
              
              newFlattenedLayers.push(individualPolygon);
              console.log(`Created individual polygon ${index} with ${polygonCoords.length} points`);
            } else {
              console.error('Map or L not available for creating individual polygon');
            }
          });
        } else {
          // Single polygon case - create a copy without handles
          if (map && L) {
            const individualPolygon = L.polygon(latlngs, {
              color: '#0066cc',
              weight: 2,
              opacity: 1.0,
              fillOpacity: 0.2,
              lineCap: 'round',
              lineJoin: 'round',
              transform: false,  // No transform handles on individual polygons
              draggable: false   // No dragging on individual polygons
            }).addTo(map);
            
            // Add CSS for crisp rendering
            if (individualPolygon._path) {
              individualPolygon._path.style.vectorEffect = 'non-scaling-stroke';
              individualPolygon._path.style.shapeRendering = 'geometricPrecision';
              individualPolygon._path.style.imageRendering = 'crisp-edges';
            }
            
            newFlattenedLayers.push(individualPolygon);
            console.log(`Created single polygon copy without handles`);
          } else {
            console.error('Map or L not available for creating single polygon copy');
          }
        }
      });
      
      // Now remove original layers from map
      layers.forEach((layer) => {
        if (layer.remove) {
          layer.remove();
        }
      });
      
      setFlattenedLayers(newFlattenedLayers);
      console.log(`Flattened ${layers.length} original layers into ${newFlattenedLayers.length} individual polygons`);
      
      // Notify parent of flattened layers
      if (onFlatten) {
        onFlatten(newFlattenedLayers);
      }
      
    } catch (error) {
      console.error('Error flattening layers:', error);
    }
  };

  const unionLayers = async () => {
    try {
      if (!map || !L) {
        console.error('Map or L not available for union operation');
        return;
      }

      // Remove layers from map before unioning
      if (flattenedLayers.length > 0) {
        // Remove flattened layers from map
        flattenedLayers.forEach((layer) => {
          if (layer.remove) {
            layer.remove();
          }
        });
      } else {
        // Remove current layers from map (when working with current layers, not flattened)
        layers.forEach((layer) => {
          if (layer.remove) {
            layer.remove();
          }
        });
      }

      // Determine which layers to union
      const layersToUnion = flattenedLayers.length > 0 ? flattenedLayers : layers;
      
      // Perform union operation on layers
      if (layersToUnion.length > 0) {
        console.log(`Unioning ${layersToUnion.length} layers (${flattenedLayers.length > 0 ? 'flattened' : 'current'})`);
        
        // Import turf functions
        const { union, featureCollection } = await import('@turf/turf');
        
        // Convert all layers to GeoJSON features
        const features = layersToUnion.map((layer) => {
          try {
            const geoJson = layer.toGeoJSON();
            // Check if the feature has valid geometry
            if (geoJson && geoJson.geometry && geoJson.geometry.type) {
              return geoJson;
            }
            return null;
          } catch (error) {
            console.error('Error converting layer to GeoJSON:', error);
            return null;
          }
        }).filter(Boolean).filter((feature: any) => 
          feature && feature.geometry && feature.geometry.type && 
          (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
        );

        if (features.length > 0) {
          // Create feature collection and union
          const fc = featureCollection(features as any);
          const unionResult = union(fc as any);
          
          if (unionResult) {
            console.log('Union result:', unionResult);
            
            // Convert GeoJSON coordinates to Leaflet format
            const geometry = unionResult.geometry;
            let latlngs;
            
            if (geometry.type === 'MultiPolygon') {
              latlngs = geometry.coordinates.map((poly: any) => L.GeoJSON.coordsToLatLngs(poly[0]));
            } else if (geometry.type === 'Polygon') {
              latlngs = [L.GeoJSON.coordsToLatLngs(geometry.coordinates[0])];
            } else {
              console.error('Unexpected geometry type:', (geometry as any).type);
              return;
            }
            
            // Create unioned layer
            const unionedLayer = L.polygon(latlngs, {
              color: '#0066cc',
              weight: 2,
              opacity: 1.0,
              fillOpacity: 0.2,
              lineCap: 'round',
              lineJoin: 'round',
              transform: true,
              draggable: true,
              pane: 'overlayPane'
            }).addTo(map);
            
            // Apply crisp rendering CSS
            if (unionedLayer._path) {
              unionedLayer._path.style.vectorEffect = 'non-scaling-stroke';
              unionedLayer._path.style.shapeRendering = 'geometricPrecision';
              unionedLayer._path.style.imageRendering = 'crisp-edges';
            }
            
            // Enable transform handles
            if (unionedLayer.transform) {
              unionedLayer.transform.setOptions({ 
                rotation: true, 
                scaling: true,
                uniformScaling: true,
                strokeWidth: 3
              });
              
              if (L.Util && L.Util.requestAnimFrame) {
                L.Util.requestAnimFrame(() => {
                  if (!unionedLayer.transform._enabled) {
                    unionedLayer.transform.enable();
                  }
                });
              } else {
                if (!unionedLayer.transform._enabled) {
                  unionedLayer.transform.enable();
                }
              }
            }
            
            // Enable dragging
            if (unionedLayer.dragging && !unionedLayer.dragging._enabled) {
              unionedLayer.dragging.enable();
            }
            
            // Update state
            setOriginalLayers([unionedLayer]);
            setFlattenedLayers([]);
            setOriginalGeometry(null);
            
            // Notify parent
            if (onUnion) {
              onUnion(unionedLayer);
            }
            
            console.log('Successfully unioned all layers including positioned layer');
          }
        }
      } else {
        console.error('No layers to union');
      }
      
      // Clear flattened layers
      setFlattenedLayers([]);
      
    } catch (error) {
      console.error('Error restoring original geometry:', error);
    }
  };

  return (
    <>
      {/* Only show button when not in selection mode */}
      {!isSelectionMode && (
        <button
          onClick={toggleTransformHandles}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors text-sm shadow-lg ${
            showTransformHandles 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showTransformHandles ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            )}
          </svg>
          <span>{showTransformHandles ? 'Flatten & Lock' : 'Union & Unlock'}</span>
        </button>
      )}
    </>
  );
}
