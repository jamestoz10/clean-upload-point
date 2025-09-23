import React, { useEffect, useRef } from 'react';

interface GroupTransformControlProps {
  map: any;
  L: any;
  layers: any[];
}

export default function GroupTransformControl({ map, L, layers }: GroupTransformControlProps) {
  const controlRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const cachedGeometriesRef = useRef<any[]>([]);
  const controlCenterRef = useRef<any>(null);
  const refCornerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const eventHandlersAttachedRef = useRef<boolean>(false);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !L || !layers.length) return;

    // Filter valid layers and disable individual transforms
    const polygonLayers = layers.filter(layer => layer && map.hasLayer(layer));
    if (polygonLayers.length === 0) return;

    // Update layers ref to avoid stale closures
    layersRef.current = polygonLayers;

    polygonLayers.forEach((layer) => {
      // Remove transform from individual layers
      if (layer.transform) {
        layer.transform.disable();
      }
    });

    // Create or update the control rectangle
    if (!controlRef.current) {
      // Create new control rectangle with SVG renderer
      const renderer = L.svg();
      const control = L.rectangle([[0, 0], [0, 0]], {
        color: '#888',
        weight: 1,
        fill: false,
        opacity: 0.6,
        dashArray: '4 4',
        transform: true,
        renderer: renderer
      }).addTo(map);

      controlRef.current = control;

      // Enable transform on next frame to avoid race conditions
      requestAnimationFrame(() => {
        if (control.transform && typeof control.transform.enable === 'function') {
          try {
            control.transform.enable({ 
              rotation: true, 
              scaling: true, 
              uniformScaling: true 
            });
          } catch (error) {
            console.warn('Failed to enable transform on control:', error);
          }
        }
      });
    }

    // Update control bounds to surround current layers
    const group = L.featureGroup(polygonLayers);
    groupRef.current = group;
    const bounds = group.getBounds();
    
    // Update the existing control's bounds instead of recreating
    controlRef.current.setBounds(bounds);

    // Attach event handlers only once
    if (!eventHandlersAttachedRef.current) {
      // Cache geometries as pixel points relative to control center
      controlRef.current.on('transformstart', () => {
        // Get the actual rectangle vertices, not the axis-aligned bounds
        const latLngs = controlRef.current.getLatLngs()[0]; // Get the 4 corners
        const centerLatLng = controlRef.current.getCenter();
        
        // Use the top-right corner as reference (index 1 in rectangle)
        const refCornerLatLng = latLngs[1];
        
        // Cache control center and reference corner as pixel points
        controlCenterRef.current = map.latLngToLayerPoint(centerLatLng);
        refCornerRef.current = map.latLngToLayerPoint(refCornerLatLng);
        
        // Cache each layer's geometry as pixel points relative to control center
        // Use current layers from ref to avoid stale closures
        cachedGeometriesRef.current = layersRef.current.map(layer => {
          const geoJson = layer.toGeoJSON();
          const geometry = geoJson.geometry;
          
          if (geometry.type === 'Polygon') {
            return geometry.coordinates.map((ring: number[][]) =>
              ring.map(([lng, lat]) => {
                const point = map.latLngToLayerPoint(L.latLng(lat, lng));
                return {
                  x: point.x - controlCenterRef.current.x,
                  y: point.y - controlCenterRef.current.y
                };
              })
            );
          } else if (geometry.type === 'MultiPolygon') {
            return geometry.coordinates.map((polygon: number[][][]) =>
              polygon.map((ring: number[][]) =>
                ring.map(([lng, lat]) => {
                  const point = map.latLngToLayerPoint(L.latLng(lat, lng));
                  return {
                    x: point.x - controlCenterRef.current.x,
                    y: point.y - controlCenterRef.current.y
                  };
                })
              )
            );
          }
          return null;
        }).filter(Boolean);
      });
      
      // Apply transform to all layers using pixel-space math
      const applyTransform = () => {
        rafRef.current = 0;

        if (!controlCenterRef.current || !refCornerRef.current || !cachedGeometriesRef.current.length) return;

        // Get current control center and reference corner as pixel points
        // Use actual rectangle vertices, not axis-aligned bounds
        const latLngs = controlRef.current.getLatLngs()[0]; // Get the 4 corners
        const centerLatLng = controlRef.current.getCenter();
        const refCornerLatLng = latLngs[1]; // Top-right corner
        
        const C1 = map.latLngToLayerPoint(centerLatLng);
        const R1 = map.latLngToLayerPoint(refCornerLatLng);

        // Calculate rotation angle from corner vector change
        const angleStart = Math.atan2(refCornerRef.current.y - controlCenterRef.current.y, refCornerRef.current.x - controlCenterRef.current.x);
        const angleNow = Math.atan2(R1.y - C1.y, R1.x - C1.x);
        const theta = angleNow - angleStart;

        // Calculate scale from corner distance ratio
        const distStart = Math.sqrt(Math.pow(refCornerRef.current.x - controlCenterRef.current.x, 2) + Math.pow(refCornerRef.current.y - controlCenterRef.current.y, 2));
        const distNow = Math.sqrt(Math.pow(R1.x - C1.x, 2) + Math.pow(R1.y - C1.y, 2));
        const scale = distNow / distStart;
        
        // Validate transformation parameters
        if (isNaN(theta) || isNaN(scale) || !isFinite(theta) || !isFinite(scale) || scale <= 0) {
          console.warn('Invalid transformation parameters:', { theta, scale, distStart, distNow });
          return; // Skip transformation if parameters are invalid
        }

        // Apply transformation to each cached geometry
        // Use current layers from ref to avoid stale closures
        layersRef.current.forEach((layer, i) => {
          const cachedGeometry = cachedGeometriesRef.current[i];
          if (!cachedGeometry) return;

          // Transform each ring of the polygon
          const transformedRings = cachedGeometry.map((ring: any[]) =>
            ring.map((point: any) => {
              // Convert original point to LatLng for fallback
              const originalLatLng = map.layerPointToLatLng(point);
              
              // Apply rotation and scale: p' = s * R(θ) * p
              const cosTheta = Math.cos(theta);
              const sinTheta = Math.sin(theta);
              const x = scale * (cosTheta * point.x - sinTheta * point.y);
              const y = scale * (sinTheta * point.x + cosTheta * point.y);
              
              // Translate to new center: p' = C1 + transformed_point
              const finalPoint = {
                x: C1.x + x,
                y: C1.y + y
              };
              
              // Validate final point before conversion
              if (isNaN(finalPoint.x) || isNaN(finalPoint.y) || !isFinite(finalPoint.x) || !isFinite(finalPoint.y)) {
                console.warn('Invalid transformed point:', finalPoint, 'original:', point);
                return originalLatLng; // Return original if transformation failed
              }
              
              // Convert back to lat/lng
              const latLng = map.layerPointToLatLng(finalPoint);
              if (!latLng || isNaN(latLng.lat) || isNaN(latLng.lng)) {
                console.warn('Invalid LatLng conversion:', latLng, 'from point:', finalPoint);
                return originalLatLng; // Return original if conversion failed
              }
              
              return latLng;
            })
          );

          // Update the layer with transformed coordinates
          layer.setLatLngs(transformedRings);
          layer.redraw();
        });
      };

      // Smooth live preview during transform
      controlRef.current.on('transform', () => {
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(applyTransform);
        }
      });

      // Final apply on transform end
      controlRef.current.on('transformend', () => {
        applyTransform();
        // Re-enable map dragging after transform
        if (map.dragging) {
          map.dragging.enable();
        }
      });

      // Disable map dragging during transform
      controlRef.current.on('transformstart', () => {
        if (map.dragging) {
          map.dragging.disable();
        }
      });
      
      eventHandlersAttachedRef.current = true;
    }

    // Cleanup function
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (controlRef.current) {
        // Properly disable transform before removing
        if (controlRef.current.transform && typeof controlRef.current.transform.disable === 'function') {
          try {
            controlRef.current.transform.disable();
          } catch (error) {
            console.warn('Error disabling transform during cleanup:', error);
          }
        }
        map.removeLayer(controlRef.current);
        controlRef.current = null;
      }
      if (groupRef.current) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }
      // Reset event handlers flag for next mount
      eventHandlersAttachedRef.current = false;
    };
  }, [map, L, layers]);

  return null; // This component doesn't render anything
}