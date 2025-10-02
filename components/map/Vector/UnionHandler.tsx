'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface UnionHandlerProps {
  map: any;
  L: any;
  selectedPolygons: any[];
  onUnionComplete?: (unionLayer: any) => void;
  onSplitComplete?: (individualLayers: any[]) => void;
  onPositionConfirmed?: (positionedGeoJson: any) => void;
}

const UnionHandler = forwardRef<any, UnionHandlerProps>(({ map, L, selectedPolygons, onUnionComplete, onSplitComplete, onPositionConfirmed }, ref) => {
  const [unionedLayer, setUnionedLayer] = useState<any>(null);
  const [originalLayers, setOriginalLayers] = useState<any[]>([]);
  const unionLayerRef = useRef<any>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    unionSelectedPolygons,
    splitUnionedLayer,
    confirmPosition
  }));

  // Clean up unioned layer when component unmounts
  useEffect(() => {
    return () => {
      if (unionLayerRef.current) {
        unionLayerRef.current.remove();
        unionLayerRef.current = null;
      }
    };
  }, []);


  const unionSelectedPolygons = async () => {
    if (selectedPolygons.length < 2) return;

    try {
      // Import turf functions
      const { union, featureCollection } = await import('@turf/turf');

      // Convert selected polygons to GeoJSON features
      const features = selectedPolygons.map((layer) => {
        try {
          return layer.toGeoJSON();
        } catch (error) {
          console.error('Error converting layer to GeoJSON:', error);
          return null;
        }
      }).filter(Boolean).filter((feature: any) => 
        feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
      );

      if (features.length < 2) {
        console.error('Not enough valid features to union');
        return;
      }

      // Create feature collection
      const fc = featureCollection(features as any);

      // Union the features
      const unionResult = union(fc as any);
      
      if (!unionResult) {
        console.error('Union operation failed');
        return;
      }

      console.log('Union result:', unionResult);
      console.log('Union geometry type:', unionResult.geometry.type);
      console.log('Union coordinates:', unionResult.geometry.coordinates);

      // Use turf.flatten to see what individual polygons we actually have
      const { flatten } = await import('@turf/turf');
      const flattenedUnion = flatten(unionResult);
      console.log('Flattened union result:', flattenedUnion);
      console.log('Number of individual polygons after union:', flattenedUnion.features.length);

      // Clean the unioned geometry using turf.cleanCoords
      const { cleanCoords } = await import('@turf/turf');
      const cleanedUnionResult = cleanCoords(unionResult);
      
      console.log('Cleaned union result:', cleanedUnionResult);
      console.log('Cleaned geometry type:', cleanedUnionResult.geometry.type);
      console.log('Cleaned coordinates:', cleanedUnionResult.geometry.coordinates);

      // Remove original layers from map
      selectedPolygons.forEach((layer) => {
        if (layer.remove) {
          layer.remove();
        }
      });

      // Create new unioned layer using the same pattern as VectorLayer.tsx
      let unionedLayer: any;
      
      try {
      // Convert GeoJSON coordinates to Leaflet format using L.GeoJSON.coordsToLatLngs
      const geometry = cleanedUnionResult.geometry;
      let latlngs;
      
      if (geometry.type === 'MultiPolygon') {
        latlngs = geometry.coordinates.map((poly: any) => L.GeoJSON.coordsToLatLngs(poly[0]));
      } else if (geometry.type === 'Polygon') {
        latlngs = [L.GeoJSON.coordsToLatLngs(geometry.coordinates[0])];
      } else {
        console.error('Unexpected geometry type:', geometry.type);
        return;
      }
      
      console.log('Converted coordinates using L.GeoJSON.coordsToLatLngs:', latlngs[0].slice(0, 3));
        
        if (cleanedUnionResult.geometry.type === 'Polygon') {
          console.log('Creating Polygon layer with coordinates:', latlngs);
          unionedLayer = L.polygon(latlngs, {
            color: '#0066cc',
            weight: 4,
            opacity: 1.0,
            fillOpacity: 0.4,
            lineCap: 'round',
            lineJoin: 'round',
            transform: true,
            draggable: true,
            pane: 'overlayPane'
          }).addTo(map);
        } else if (cleanedUnionResult.geometry.type === 'MultiPolygon') {
          console.log('Creating MultiPolygon layer with coordinates:', latlngs);
          unionedLayer = L.polygon(latlngs, {
            color: '#0066cc',
            weight: 4,
            opacity: 1.0,
            fillOpacity: 0.4,
            lineCap: 'round',
            lineJoin: 'round',
            transform: true,
            draggable: true,
            pane: 'overlayPane'
          }).addTo(map);
        } else {
          console.error('Unexpected geometry type:', (cleanedUnionResult.geometry as any).type);
          return;
        }
        
        console.log('Successfully created unioned layer:', unionedLayer);
        console.log('Layer added to map:', map.hasLayer(unionedLayer));
        console.log('Layer bounds:', unionedLayer.getBounds());
        console.log('Layer center:', unionedLayer.getBounds().getCenter());
        
        // Log the coordinates of the unioned layer
        console.log('=== UNIONED LAYER COORDINATES ===');
        console.log('Layer coordinates:', unionedLayer.getLatLngs());
        console.log('Number of coordinate arrays:', unionedLayer.getLatLngs().length);
        unionedLayer.getLatLngs().forEach((coords: any, index: number) => {
          console.log(`Polygon ${index + 1} coordinates:`, coords.slice(0, 3)); // Show first 3 points
        });
        console.log('=== END UNIONED LAYER COORDINATES ===');
        
        // Ensure the layer is on top
        unionedLayer.bringToFront();
        
        // Add CSS to prevent stroke scaling and improve crispness (same as VectorLayer)
        if (unionedLayer._path) {
          unionedLayer._path.style.vectorEffect = 'non-scaling-stroke';
          unionedLayer._path.style.shapeRendering = 'geometricPrecision';
          unionedLayer._path.style.imageRendering = 'crisp-edges';
        }
        
        // Enable transform handles (following the exact VectorLayer pattern)
        if (unionedLayer.transform) {
          // Set options first, then enable (like VectorLayer)
          unionedLayer.transform.setOptions({ 
            rotation: true, 
            scaling: true,
            uniformScaling: true,
            strokeWidth: 3
          });
          
          // Use requestAnimFrame to ensure proper timing (same as VectorLayer)
          if (L.Util && L.Util.requestAnimFrame) {
            L.Util.requestAnimFrame(() => {
              if (!unionedLayer.transform._enabled) {
                unionedLayer.transform.enable();
              }
            });
          } else {
            // Fallback if requestAnimFrame is not available
            if (!unionedLayer.transform._enabled) {
              unionedLayer.transform.enable();
            }
          }
        }
        
        // Enable drag functionality using leaflet-path-drag (same as VectorLayer)
        console.log('Layer dragging property:', unionedLayer.dragging);
        if (unionedLayer.dragging && !unionedLayer.dragging._enabled) {
          unionedLayer.dragging.enable();
          console.log('Enabled dragging for unioned layer');
        } else if (!unionedLayer.dragging) {
          console.warn('No dragging property found on unioned layer - leaflet-path-drag may not be loaded');
        }
        
        // Final check
        console.log('Final layer check - on map:', map.hasLayer(unionedLayer));
        console.log('Final layer check - visible:', unionedLayer._path && unionedLayer._path.style.display !== 'none');
        
      } catch (layerError) {
        console.error('Error creating unioned layer:', layerError);
        return;
      }

      // Store references
      setUnionedLayer(unionedLayer);
      setOriginalLayers([...selectedPolygons]);
      unionLayerRef.current = unionedLayer;

      // Notify parent
      if (onUnionComplete) {
        onUnionComplete(unionedLayer);
      }

      console.log('Successfully created unioned layer with transform handles');

    } catch (error) {
      console.error('Error creating union:', error);
    }
  };

  const confirmPosition = async () => {
    if (!unionedLayer) return;

    try {
      console.log('Confirming position - keeping polygons in new location...');
      
      // Disable transform handles
      if (unionedLayer.transform && unionedLayer.transform._enabled) {
        unionedLayer.transform.disable();
        console.log('Disabled transform handles');
      }

      // Disable dragging
      if (unionedLayer.dragging && unionedLayer.dragging._enabled) {
        unionedLayer.dragging.disable();
        console.log('Disabled dragging');
      }

      // Change styling to match the main layer
      unionedLayer.setStyle({
        color: '#0066cc',
        weight: 2,
        opacity: 1.0,
        fillOpacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // Get the positioned polygon's GeoJSON data
      const positionedGeoJson = unionedLayer.toGeoJSON();
      console.log('Stored positioned polygon GeoJSON:', positionedGeoJson);

      // Log the coordinates before flattening
      console.log('=== BEFORE FLATTENING ===');
      console.log('Positioned GeoJSON geometry type:', positionedGeoJson.geometry.type);
      console.log('Positioned GeoJSON coordinates:', positionedGeoJson.geometry.coordinates);
      if (positionedGeoJson.geometry.type === 'MultiPolygon') {
        console.log('Number of polygons in MultiPolygon:', positionedGeoJson.geometry.coordinates.length);
        positionedGeoJson.geometry.coordinates.forEach((polyCoords: any, index: number) => {
          console.log(`MultiPolygon polygon ${index + 1} coordinates:`, polyCoords[0].slice(0, 3));
        });
      }
      console.log('=== END BEFORE FLATTENING ===');

      // Use turf.flatten to split MultiPolygon into individual Polygon features
      const { flatten } = await import('@turf/turf');
      let flattenedFeatures;
      
      if (positionedGeoJson.geometry.type === 'Polygon' && positionedGeoJson.geometry.coordinates.length > 1) {
        // This is a Polygon with holes - manually split into individual polygons
        console.log('Detected Polygon with holes, manually splitting...');
        flattenedFeatures = {
          type: 'FeatureCollection',
          features: positionedGeoJson.geometry.coordinates.map((coords: any, index: number) => ({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [coords] // Each hole becomes a separate polygon
            },
            properties: {
              id: `polygon_${index}`,
              originalIndex: index
            }
          }))
        };
        console.log('Manually split into', flattenedFeatures.features.length, 'individual polygons');
      } else {
        // Use turf.flatten for normal cases
        flattenedFeatures = flatten(positionedGeoJson);
      }
      
      console.log('Flattened features:', flattenedFeatures);
      console.log('Number of individual polygons:', flattenedFeatures.features.length);

      // Log the coordinates after flattening
      console.log('=== AFTER FLATTENING ===');
      flattenedFeatures.features.forEach((feature: any, index: number) => {
        console.log(`Flattened polygon ${index + 1}:`, feature.geometry.type);
        console.log(`Flattened polygon ${index + 1} coordinates:`, feature.geometry.coordinates[0].slice(0, 3));
      });
      console.log('=== END AFTER FLATTENING ===');

      // Remove the unioned layer first
      unionedLayer.remove();
      
      // Create individual polygon layers from the flattened features
      const transformedPolygons: any[] = [];
      
      flattenedFeatures.features.forEach((feature: any, index: number) => {
        if (feature.geometry.type === 'Polygon') {
          const latlngs = L.GeoJSON.coordsToLatLngs(feature.geometry.coordinates[0]);
          
          const newPolygon = L.polygon(latlngs, {
            color: '#0066cc',
            weight: 2,
            opacity: 1.0,
            fillOpacity: 0.2,
            lineCap: 'round',
            lineJoin: 'round',
            transform: false,  // No handles
            draggable: false   // No dragging
          }).addTo(map);
          
          // Apply crisp rendering CSS
          if (newPolygon._path) {
            newPolygon._path.style.vectorEffect = 'non-scaling-stroke';
            newPolygon._path.style.shapeRendering = 'geometricPrecision';
            newPolygon._path.style.imageRendering = 'crisp-edges';
          }
          
          transformedPolygons.push(newPolygon);
          console.log(`Created individual polygon ${index + 1} from flattened feature`);
        }
      });

      // Log the final created polygons
      console.log('=== FINAL CREATED POLYGONS ===');
      console.log(`Total polygons created: ${transformedPolygons.length}`);
      transformedPolygons.forEach((polygon: any, index: number) => {
        console.log(`Final polygon ${index + 1} coordinates:`, polygon.getLatLngs()[0].slice(0, 3));
        console.log(`Final polygon ${index + 1} bounds:`, polygon.getBounds());
      });
      console.log('=== END FINAL CREATED POLYGONS ===');

      // Clear the unioned layer state
      setUnionedLayer(null);
      setOriginalLayers([]);

      // Notify parent with the individual transformed polygons
      if (onPositionConfirmed) {
        onPositionConfirmed(transformedPolygons);
      }

      console.log('Successfully confirmed position - polygons kept in new location');

    } catch (error) {
      console.error('Error confirming position:', error);
    }
  };

  const splitUnionedLayer = () => {
    if (!unionedLayer || !originalLayers.length) return;

    try {
      // Remove unioned layer from map
      if (unionLayerRef.current) {
        unionLayerRef.current.remove();
        unionLayerRef.current = null;
      }

      // Restore original layers
      originalLayers.forEach((layer) => {
        if (layer.addTo) {
          layer.addTo(map);
        }
      });

      // Reset state
      setUnionedLayer(null);
      setOriginalLayers([]);

      // Notify parent
      if (onSplitComplete) {
        onSplitComplete(originalLayers);
      }

      console.log('Successfully split unioned layer back to individual polygons');

    } catch (error) {
      console.error('Error splitting unioned layer:', error);
    }
  };

  // Don't render anything - this component is used only for its methods via ref
  return null;
});

UnionHandler.displayName = 'UnionHandler';

export default UnionHandler;
