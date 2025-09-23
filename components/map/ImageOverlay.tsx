'use client';

import { useEffect, useRef } from 'react';

export default function ImageOverlay({ map, imageUrl, imageData, L }: { map: any; imageUrl: string; imageData?: any; L?: any }) {
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
          return;
        }
        
        if (disposed) return;

        // Wait for map to be fully ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
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

        // Get placement coordinates - use postcode coordinates if available, otherwise use map center
        let center, zoom;
        try {
          if (imageData && imageData.postcodeCoordinates) {
            // Use postcode coordinates for image placement
            center = {
              lat: imageData.postcodeCoordinates.lat,
              lng: imageData.postcodeCoordinates.lng
            };
            zoom = map.getZoom();
          } else {
            // Fallback to map center
            center = map.getCenter();
            zoom = map.getZoom();
          }
        } catch (error) {
          center = { lat: 0, lng: 0 };
          zoom = 2;
        }
        
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
  }, [map, imageUrl, imageData]);

  return null;
}
