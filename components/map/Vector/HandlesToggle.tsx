'use client';

import { useState } from 'react';

interface HandlesToggleProps {
  layers: any[];
  onToggle?: (showHandles: boolean) => void;
  onFlatten?: (flattenedLayers: any[]) => void;
  onUnion?: (unionLayer: any) => void;
}

export default function HandlesToggle({ layers, onToggle, onFlatten, onUnion }: HandlesToggleProps) {
  // Controls both transform handles and dragging functionality
  const [showTransformHandles, setShowTransformHandles] = useState<boolean>(true);
  const [originalLayers, setOriginalLayers] = useState<any[]>([]);
  const [flattenedLayers, setFlattenedLayers] = useState<any[]>([]);
  const [originalGeometry, setOriginalGeometry] = useState<any>(null);

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
      // Store original layers and their geometry
      setOriginalLayers([...layers]);
      
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
            const map = originalLayer._map;
            const L = (window as any).L;
            
            if (map && L) {
              const individualPolygon = L.polygon(polygonCoords, {
                color: '#092',  // Same green color for all individual polygons
                weight: 3,
                opacity: 0.9,
                fillOpacity: 0.3,
                transform: false,  // No transform handles on individual polygons
                draggable: false   // No dragging on individual polygons
              }).addTo(map);
              
              // Do NOT enable transform handles or dragging on individual polygons
              
              newFlattenedLayers.push(individualPolygon);
              console.log(`Created individual polygon ${index} with ${polygonCoords.length} points`);
            } else {
              console.error('Map or L not available for creating individual polygon');
            }
          });
        } else {
          // Single polygon case - create a copy without handles
          const map = originalLayer._map;
          const L = (window as any).L;
          
          if (map && L) {
            const individualPolygon = L.polygon(latlngs, {
              color: '#092',
              weight: 3,
              opacity: 0.9,
              fillOpacity: 0.3,
              transform: false,  // No transform handles on individual polygons
              draggable: false   // No dragging on individual polygons
            }).addTo(map);
            
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
      // Store map reference before removing layers
      const map = flattenedLayers[0]?._map;
      const L = (window as any).L;
      
      if (!map || !L) {
        console.error('Map or L not available for union operation');
        return;
      }

      // Remove flattened layers from map
      flattenedLayers.forEach((layer) => {
        if (layer.remove) {
          layer.remove();
        }
      });

      // Restore the original geometry instead of unioning
      if (originalGeometry) {
        console.log('Restoring original geometry:', originalGeometry);
        
        // Convert GeoJSON geometry to regular polygon layer for handles support
        const geometry = originalGeometry.geometry || originalGeometry;
        console.log('Restoring geometry type:', geometry.type);
        console.log('Geometry coordinates:', geometry.coordinates);
        let restoredLayer;
        
        if (geometry.type === 'MultiPolygon') {
          // For MultiPolygon, create individual polygons and group them
          const polygons = geometry.coordinates.map((polygonCoords: any) => {
            // polygonCoords is an array of rings (exterior + holes)
            const latlngs = polygonCoords.map((ring: any) => 
              ring.map((coord: any) => [coord[1], coord[0]])
            );
            return L.polygon(latlngs, {
              color: '#092',
              weight: 3,
              opacity: 0.9,
              fillOpacity: 0.3,
              transform: true,
              draggable: true
            });
          });
          
          // Create a feature group to hold all polygons
          restoredLayer = L.featureGroup(polygons).addTo(map);
          
        } else if (geometry.type === 'Polygon') {
          // For single Polygon, create regular polygon layer (handle holes)
          const latlngs = geometry.coordinates.map((ring: any) => 
            ring.map((coord: any) => [coord[1], coord[0]])
          );
          restoredLayer = L.polygon(latlngs, {
            color: '#092',
            weight: 3,
            opacity: 0.9,
            fillOpacity: 0.3,
            transform: true,
            draggable: true
          }).addTo(map);
        }
        
        // Enable transform handles on the restored layer
        if (restoredLayer.transform) {
          restoredLayer.transform.enable();
          restoredLayer.transform.setOptions({ 
            rotation: true, 
            scaling: true,
            uniformScaling: true,
            strokeWidth: 3
          });
        } else if (restoredLayer.eachLayer) {
          // For feature groups, enable handles on each polygon
          restoredLayer.eachLayer((layer: any) => {
            if (layer.transform) {
              layer.transform.enable();
              layer.transform.setOptions({ 
                rotation: true, 
                scaling: true,
                uniformScaling: true,
                strokeWidth: 3
              });
            }
            if (layer.dragging) {
              layer.dragging.enable();
            }
          });
        }
        
        // Enable dragging on the restored layer
        if (restoredLayer.dragging) {
          restoredLayer.dragging.enable();
        }
        
        console.log('Restored original layer with handles enabled');
        
        // Notify parent of restored layer
        if (onUnion) {
          onUnion(restoredLayer);
        }
      } else {
        console.error('No original geometry stored to restore');
      }
      
      // Clear flattened layers
      setFlattenedLayers([]);
      
    } catch (error) {
      console.error('Error restoring original geometry:', error);
    }
  };

  return (
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
  );
}
