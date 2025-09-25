'use client';

import { useState, useEffect, useRef } from 'react';

interface PolygonSelectorProps {
  map: any;
  L: any;
  layers: any[];
  isActive: boolean; // Only active when main layer handles are locked
}

export default function PolygonSelector({ map, L, layers, isActive }: PolygonSelectorProps) {
  const [selectedPolygons, setSelectedPolygons] = useState<any[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<any>(null);
  const [dragEnd, setDragEnd] = useState<any>(null);
  const [dragBounds, setDragBounds] = useState<any>(null);
  const selectionGroupRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<any>(null);

  // Debug layers
  console.log('PolygonSelector: Received layers:', { 
    layersCount: layers.length, 
    isActive, 
    layers: layers.map((layer, i) => ({ 
      index: i, 
      type: layer.constructor.name,
      hasBounds: typeof layer.getBounds === 'function'
    }))
  });

  // Clear selection when component becomes inactive
  useEffect(() => {
    if (!isActive) {
      // Re-enable map dragging when component becomes inactive
      if (map && map.dragging) {
        map.dragging.enable();
      }
      
      // Clean up any active drag selection
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragBounds(null);
      
      clearSelection();
      setIsSelectionMode(false);
    }
  }, [isActive]);

  // Clean up selection group when component unmounts or becomes inactive
  useEffect(() => {
    return () => {
      if (selectionGroupRef.current) {
        selectionGroupRef.current.remove();
        selectionGroupRef.current = null;
      }
    };
  }, []);

  const clearSelection = () => {
    // Remove visual highlighting
    selectedPolygons.forEach((polygon) => {
      if (polygon.setStyle) {
        polygon.setStyle({
          color: ['#092', '#0066cc', '#cc6600'][0], // Default to first color
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.3
        });
      }
    });

    // Remove selection group
    if (selectionGroupRef.current) {
      selectionGroupRef.current.remove();
      selectionGroupRef.current = null;
    }

    setSelectedPolygons([]);
  };

  const toggleSelectionMode = () => {
    const newMode = !isSelectionMode;
    setIsSelectionMode(newMode);
    
    if (!newMode) {
      // Re-enable map dragging when exiting selection mode
      if (map && map.dragging) {
        map.dragging.enable();
      }
      
      // Clean up any active drag selection
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragBounds(null);
      
      clearSelection();
    }
  };

  const selectPolygonsInBounds = (bounds: any) => {
    if (!isSelectionMode) {
      console.log('selectPolygonsInBounds: Not in selection mode');
      return;
    }

    console.log('selectPolygonsInBounds called with:', { 
      bounds, 
      layersCount: layers.length,
      boundsString: bounds.toString(),
      boundsNorthEast: bounds.getNorthEast(),
      boundsSouthWest: bounds.getSouthWest()
    });

    const polygonsInBounds: any[] = [];
    
    layers.forEach((layer, index) => {
      try {
        const layerBounds = layer.getBounds();
        const intersects = bounds.intersects(layerBounds);
        console.log(`Layer ${index}:`, { 
          layerBounds: layerBounds.toString(),
          layerNorthEast: layerBounds.getNorthEast(),
          layerSouthWest: layerBounds.getSouthWest(),
          intersects,
          layerType: layer.constructor.name
        });
        
        if (intersects) {
          polygonsInBounds.push(layer);
        }
      } catch (error) {
        console.error(`Error processing layer ${index}:`, error, layer);
      }
    });

    console.log('Polygons in bounds:', polygonsInBounds.length);

    // Add new selections
    polygonsInBounds.forEach((polygon) => {
      if (!selectedPolygons.includes(polygon)) {
        polygon.setStyle({
          color: '#ff0000',
          weight: 4,
          opacity: 1,
          fillOpacity: 0.5,
          dashArray: '5, 5'
        });
      }
    });

    // Remove selections that are no longer in bounds
    selectedPolygons.forEach((polygon) => {
      if (!polygonsInBounds.includes(polygon)) {
        polygon.setStyle({
          color: '#092', // Default green color
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.3
        });
      }
    });

    setSelectedPolygons(polygonsInBounds);
  };

  const moveSelectedPolygons = (offset: { x: number; y: number }) => {
    if (selectedPolygons.length === 0) return;

    selectedPolygons.forEach((polygon) => {
      const currentLatLngs = polygon.getLatLngs();
      
      if (Array.isArray(currentLatLngs[0])) {
        // MultiPolygon case
        const newLatLngs = currentLatLngs.map((polygonCoords: any) =>
          polygonCoords.map((latlng: any) => {
            const newLatLng = map.containerPointToLatLng([
              map.latLngToContainerPoint(latlng).x + offset.x,
              map.latLngToContainerPoint(latlng).y + offset.y
            ]);
            return newLatLng;
          })
        );
        polygon.setLatLngs(newLatLngs);
      } else {
        // Single Polygon case
        const newLatLngs = currentLatLngs.map((latlng: any) => {
          const newLatLng = map.containerPointToLatLng([
            map.latLngToContainerPoint(latlng).x + offset.x,
            map.latLngToContainerPoint(latlng).y + offset.y
          ]);
          return newLatLng;
        });
        polygon.setLatLngs(newLatLngs);
      }
    });
  };

  // Add drag selection event listeners when selection mode is active
  useEffect(() => {
    if (!isSelectionMode || !isActive || !map || !L) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left mouse button
      
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      
      // Disable map dragging
      map.dragging.disable();
      
      // Get screen coordinates relative to map container
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Set refs immediately
      isDraggingRef.current = true;
      dragStartRef.current = { x, y };
      
      // Set state for UI updates
      setIsDragging(true);
      setDragStart({ x, y });
      setDragEnd({ x, y });
      setDragBounds({
        left: x,
        top: y,
        width: 0,
        height: 0
      });
      
      console.log('Mouse down - drag started:', { x, y });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        console.log('Mouse move - not dragging (ref)');
        return;
      }
      
      console.log('Mouse move - dragging, processing...');
      
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      
      // Get screen coordinates relative to map container
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      console.log('Mouse move - coordinates:', { x, y, clientX: e.clientX, clientY: e.clientY, rect });
      
      setDragEnd({ x, y });
      
      // Update drag bounds using ref
      if (dragStartRef.current) {
        const left = Math.min(dragStartRef.current.x, x);
        const top = Math.min(dragStartRef.current.y, y);
        const width = Math.abs(x - dragStartRef.current.x);
        const height = Math.abs(y - dragStartRef.current.y);
        
        setDragBounds({ left, top, width, height });
        console.log('Mouse move - bounds:', { left, top, width, height, dragStartRef: dragStartRef.current });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      
      // Re-enable map dragging
      map.dragging.enable();
      
      // Clear refs
      isDraggingRef.current = false;
      
      // Set state for UI updates
      setIsDragging(false);
      
      // Select polygons in bounds
      if (dragStartRef.current && dragEnd) {
        // Convert screen coordinates to lat/lng
        const startContainerPoint = L.point(dragStartRef.current.x, dragStartRef.current.y);
        const endContainerPoint = L.point(dragEnd.x, dragEnd.y);
        const startLatLng = map.containerPointToLatLng(startContainerPoint);
        const endLatLng = map.containerPointToLatLng(endContainerPoint);
        const bounds = L.latLngBounds(startLatLng, endLatLng);
        
        console.log('Mouse up - selecting polygons in bounds:', {
          dragStart: dragStartRef.current,
          dragEnd,
          startContainerPoint,
          endContainerPoint,
          startLatLng,
          endLatLng,
          bounds: bounds.toString(),
          boundsNorthEast: bounds.getNorthEast(),
          boundsSouthWest: bounds.getSouthWest(),
          layersCount: layers.length,
          mapCenter: map.getCenter(),
          mapZoom: map.getZoom()
        });
        
        selectPolygonsInBounds(bounds);
      }
      
      setDragStart(null);
      setDragEnd(null);
      setDragBounds(null);
      dragStartRef.current = null;
    };

    // Add event listeners to map container
    const mapContainer = map.getContainer();
    mapContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add a simple test listener to see if mousemove works at all
    const testMouseMove = (e: MouseEvent) => {
      console.log('Test mousemove triggered:', e.clientX, e.clientY);
    };
    document.addEventListener('mousemove', testMouseMove);

    return () => {
      // Clean up event listeners
      mapContainer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', testMouseMove);
      
      // Clean up drag state
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragBounds(null);
    };
  }, [isSelectionMode, isActive, map, L, layers]);

  // Keyboard controls for moving selected polygons
  useEffect(() => {
    if (!isSelectionMode || selectedPolygons.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveDistance = 10; // pixels
      let offset = { x: 0, y: 0 };

      switch (e.key) {
        case 'ArrowUp':
          offset.y = -moveDistance;
          break;
        case 'ArrowDown':
          offset.y = moveDistance;
          break;
        case 'ArrowLeft':
          offset.x = -moveDistance;
          break;
        case 'ArrowRight':
          offset.x = moveDistance;
          break;
        case 'Escape':
          clearSelection();
          return;
        default:
          return;
      }

      e.preventDefault();
      moveSelectedPolygons(offset);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, selectedPolygons]);

  if (!isActive) {
    console.log('PolygonSelector: Component not active');
    return null;
  }

  console.log('PolygonSelector: Rendering component', { isSelectionMode, isDragging, dragBounds });

  return (
    <>
      {/* Dashed selection rectangle */}
      {isDragging && dragBounds && (
        <div
          className="absolute border-2 border-red-500 border-dashed bg-red-100 bg-opacity-20 pointer-events-none z-[1003]"
          style={{
            left: `${dragBounds.left}px`,
            top: `${dragBounds.top}px`,
            width: `${Math.max(dragBounds.width, 1)}px`,
            height: `${Math.max(dragBounds.height, 1)}px`,
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: '#ef4444',
            minWidth: '1px',
            minHeight: '1px'
          }}
        />
      )}
      
      {/* Debug info */}
      {isDragging && (
        <div className="absolute top-20 left-4 bg-black text-white p-2 text-xs z-[1004]">
          Dragging: {isDragging ? 'Yes' : 'No'}<br/>
          Bounds: {dragBounds ? `${dragBounds.width}x${dragBounds.height}` : 'None'}<br/>
          Start: {dragStart ? `${dragStart.x},${dragStart.y}` : 'None'}<br/>
          End: {dragEnd ? `${dragEnd.x},${dragEnd.y}` : 'None'}
        </div>
      )}
      
      <div className="absolute top-4 left-4 z-[1002]">
        <div className="flex flex-col space-y-2">
        <button
          onClick={toggleSelectionMode}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors text-sm shadow-lg ${
            isSelectionMode 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span>{isSelectionMode ? 'Exit Selection' : 'Select Polygons'}</span>
        </button>
        
        {/* Debug button */}
        <button
          onClick={() => {
            console.log('Manual test - selecting all polygons');
            layers.forEach((layer, index) => {
              console.log(`Layer ${index}:`, layer);
              try {
                layer.setStyle({
                  color: '#ff0000',
                  weight: 4,
                  opacity: 1,
                  fillOpacity: 0.5,
                  dashArray: '5, 5'
                });
              } catch (error) {
                console.error(`Error styling layer ${index}:`, error);
              }
            });
          }}
          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm shadow-lg"
        >
          <span>Test Select All</span>
        </button>
        
        {/* Test bounds button */}
        <button
          onClick={() => {
            console.log('Test bounds intersection');
            const mapCenter = map.getCenter();
            const testBounds = L.latLngBounds(
              L.latLng(mapCenter.lat - 0.01, mapCenter.lng - 0.01),
              L.latLng(mapCenter.lat + 0.01, mapCenter.lng + 0.01)
            );
            console.log('Test bounds:', testBounds.toString());
            selectPolygonsInBounds(testBounds);
          }}
          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700 text-sm shadow-lg"
        >
          <span>Test Bounds</span>
        </button>

        {isSelectionMode && (
          <div className="bg-white rounded-md shadow-lg p-3 text-xs text-gray-600">
            <div className="font-medium mb-2">Drag Selection Mode Active</div>
            <div className="space-y-1">
              <div>• Drag to create selection box</div>
              <div>• Use arrow keys to move selected</div>
              <div>• Press ESC to clear selection</div>
              <div>• Drag again to change selection</div>
            </div>
            {selectedPolygons.length > 0 && (
              <div className="mt-2 font-medium text-blue-600">
                {selectedPolygons.length} polygon{selectedPolygons.length !== 1 ? 's' : ''} selected
              </div>
            )}
            {isDragging && (
              <div className="mt-2 text-red-600 font-medium">
                Dragging selection...
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </>
  );
}
