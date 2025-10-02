'use client';

import { useEffect, useRef, useState } from 'react';

interface MapContainerProps {
  className?: string;
  center?: [number, number];
  zoom?: number;
  onMapReady?: (map: any, L: any) => void;
  fileType?: 'image' | 'vector' | 'both' | 'none';
}

export default function MapContainer({ 
  className = '', 
  center = [0, 0], // Default to world center
  zoom = 2,
  onMapReady,
  fileType = 'none'
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current) return;

    let cancelled = false;
    let onResize: (() => void) | null = null;

    (async () => {
      try {
        const LeafletMod = await import('leaflet');
        const L = (LeafletMod as any).default || LeafletMod;
        if (typeof window !== 'undefined') {
          (window as any).L = L;
        }
        LRef.current = L;

        // Load plugins based on file type
        try {
          await import('leaflet-toolbar/dist/leaflet.toolbar.js');
        } catch (e) {
          // Ignore plugin load errors
        }

        // Only load distortable image plugin for images
        if (fileType === 'image' || fileType === 'both') {
          try {
            await import('leaflet-distortableimage');
          } catch (e) {
            // Ignore plugin load errors
          }
        }

        // Only load path transform and drag plugins for vectors
        if (fileType === 'vector' || fileType === 'both') {
          try {
            await import('leaflet-path-transform' as any);
          } catch (e) {
            // Ignore plugin load errors
          }
          
          try {
            await import('leaflet-path-drag' as any);
          } catch (e) {
            // Ignore plugin load errors
          }
        }

        if (cancelled) return;
        
        const map = L.map(mapRef.current!, { 
          center: center, 
          zoom: zoom,
          zoomControl: false,
          minZoom: 1,
          maxZoom: 24,
          zoomSnap: 0.1,
          zoomDelta: 0.1,
          wheelPxPerZoomLevel: 60
        });
        mapInstanceRef.current = map;
        
        if (typeof window !== 'undefined') {
          (window as any).currentMapInstance = map;
        }

        // Add Esri satellite imagery as base layer with over-zoom support
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxNativeZoom: 19, // provider's real max
          maxZoom: 24,       // allow client-side over-zoom so it never goes blank
          minZoom: 1
        }).addTo(map);

        // Add place labels on top of satellite imagery with over-zoom support
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxNativeZoom: 19, // provider's real max
          maxZoom: 24,       // allow client-side over-zoom so it never goes blank
          minZoom: 1
        }).addTo(map);

        // Ensure proper sizing
        requestAnimationFrame(() => map.invalidateSize());
        onResize = () => map.invalidateSize();
        window.addEventListener('resize', onResize);

        // Wait for map to be fully ready
        requestAnimationFrame(() => {
          map.invalidateSize();
          
          setTimeout(() => {
            try {
              if (typeof map.getPane !== 'function') return;
              
              const overlayPane = map.getPane('overlayPane');
              const markerPane = map.getPane('markerPane');
              const tooltipPane = map.getPane('tooltipPane');
              
              if (!overlayPane || !markerPane || !tooltipPane) return;
              if (!(overlayPane instanceof HTMLElement)) return;
              if (!(markerPane instanceof HTMLElement)) return;
              if (!(tooltipPane instanceof HTMLElement)) return;
              
              map.invalidateSize();
              
              if (onMapReady) {
                setTimeout(() => {
                  if (map.getPane && map.getContainer() && map.getPane('overlayPane')) {
                    onMapReady(map, L);
                  }
                }, 100);
              }
            } catch (error) {
              // Ignore map readiness errors
            }
          }, 150);
        });
        
      } catch (e) {
        // Ignore initialization errors
      }
    })();

    return () => {
      cancelled = true;
      if (onResize) {
        window.removeEventListener('resize', onResize);
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, []); // Remove dependencies to prevent infinite re-renders

  // Update map view when center or zoom changes
  useEffect(() => {
    if (mapInstanceRef.current && center && zoom) {
      try {
        mapInstanceRef.current.setView(center, zoom);
      } catch (error) {
        // Ignore setView errors
      }
    }
  }, [center, zoom]);

  return (
    <div className="relative w-full h-screen">
      <div 
        ref={mapRef} 
        className={`w-full h-full ${className}`}
        style={{ minHeight: '100vh', zIndex: 1 }}
      />
    </div>
  );
}
