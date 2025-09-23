'use client';

import { useEffect, useRef } from 'react';

export default function ImageOverlay({ map, imageUrl, imageData, L, postcodeCoordinates }: { 
  map: any; 
  imageUrl: string; 
  imageData?: any; 
  L?: any;
  postcodeCoordinates?: { lat: number; lng: number };
}) {
  const currentImageRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !imageUrl) return;
    
    if (typeof map.getPane !== 'function' || typeof map.getContainer !== 'function') {
      return;
    }
    
    let disposed = false;

    const setupImageOverlay = async () => {
      try {
        let LeafletInstance = L;
        if (!LeafletInstance && typeof window !== 'undefined') {
          LeafletInstance = (window as any).L;
        }
        
        if (!LeafletInstance || typeof LeafletInstance.distortableImageOverlay !== 'function') {
          console.warn('ImageOverlay - leaflet-distortableimage plugin not available, skipping image overlay');
          return;
        }
        
        if (disposed) return;

        // Wait for map to be ready (no need to wait for centering)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (disposed) return;

        // Clean up previous overlay
        if (currentImageRef.current) {
          try { 
            if (map && typeof map.removeLayer === 'function') {
              map.removeLayer(currentImageRef.current); 
            }
          } catch (error) {
            // Ignore cleanup errors
          }
          currentImageRef.current = null;
        }

        // Get placement coordinates - use passed postcode coordinates directly
        let center, zoom;
        try {
          console.log('ImageOverlay - Starting coordinate detection...');
          console.log('ImageOverlay - postcodeCoordinates prop:', postcodeCoordinates);
          
          if (postcodeCoordinates) {
            // Use the passed postcode coordinates directly
            center = {
              lat: postcodeCoordinates.lat,
              lng: postcodeCoordinates.lng
            };
            zoom = 15; // Use postcode zoom level
            console.log('ImageOverlay - Using passed postcode coordinates:', center);
          } else {
            console.log('ImageOverlay - No postcode coordinates passed, using map center...');
            // Fallback to map center
            center = map.getCenter();
            zoom = map.getZoom();
            console.log('ImageOverlay - Using map center:', center);
          }
        } catch (error) {
          console.log('ImageOverlay - Coordinate detection error:', error);
          center = { lat: 0, lng: 0 };
          zoom = 2;
        }
        
        console.log('ImageOverlay - Final coordinates for image placement:', { center, zoom });
        
        // Create image overlay
        let img: any;
        try {
          const latOffset = 0.005 / Math.pow(2, 15 - zoom);
          const lngOffset = 0.005 / Math.pow(2, 15 - zoom);
          
          const bounds = [
            [center.lat - latOffset, center.lng - lngOffset] as [number, number],
            [center.lat + latOffset, center.lng + lngOffset] as [number, number]
          ];

          img = LeafletInstance.distortableImageOverlay(imageUrl, {
            selected: false,
            mode: 'distort',
            suppressToolbar: false,
            bounds: bounds,
            actions: [
              LeafletInstance.FreeRotateAction,
              LeafletInstance.DistortAction,
              LeafletInstance.LockAction,
              LeafletInstance.BorderAction,
              LeafletInstance.OpacityAction,
              LeafletInstance.RestoreAction,
              LeafletInstance.DeleteAction,
            ],
          });

          if (img && typeof img.addTo === 'function') {
            img.addTo(map);
          } else {
            return;
          }

          currentImageRef.current = img;
          
          if (img && typeof img.once === 'function') {
            img.once('load', () => {
              try {
                if (disposed) return;
                if (img && img.editing && typeof img.editing.select === 'function') {
                  img.editing.select();
                }
              } catch (e) {
                // Ignore selection errors
              }
            });
          }
        } catch (error) {
          return;
        }

      } catch (error) {
        if (currentImageRef.current) {
          currentImageRef.current = null;
        }
      }
    };

    setupImageOverlay();

    return () => {
      disposed = true;
      if (map && currentImageRef.current) {
        try { 
          if (typeof map.removeLayer === 'function') {
            map.removeLayer(currentImageRef.current); 
          }
        } catch (error) {
          // Ignore cleanup errors
        }
        currentImageRef.current = null;
      }
    };
  }, [map, imageUrl, imageData, postcodeCoordinates]);

  return null;
}
