'use client';

import { useState, useEffect, useRef } from 'react';
import UnionHandler from './UnionHandler';

interface PolygonSelectorProps {
  map: any;
  L: any;
  layers: any[];
  isActive: boolean; // Only active when main layer handles are locked
  onPositionConfirmed?: (positionedGeoJson: any) => void;
  onRemoveOriginalPolygons?: (polygonsToRemove: any[]) => void;
  onSelectionModeChange?: (isSelectionMode: boolean) => void;
}

export default function PolygonSelector({ map, L, layers, isActive, onPositionConfirmed, onRemoveOriginalPolygons, onSelectionModeChange }: PolygonSelectorProps) {
  const [selectedPolygons, setSelectedPolygons] = useState<any[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<any>(null);
  const [dragEnd, setDragEnd] = useState<any>(null);
  const [dragBounds, setDragBounds] = useState<any>(null);
  const [unionedLayer, setUnionedLayer] = useState<any>(null);
  const [isPositionConfirmed, setIsPositionConfirmed] = useState<boolean>(false);
  const [remainingPolygons, setRemainingPolygons] = useState<any[]>([]);
  const selectionGroupRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<any>(null);
  const dragEndRef = useRef<any>(null);


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
    // Clear ALL layers, not just selected ones
    layers.forEach((polygon) => {
      if (polygon.setStyle) {
        polygon.setStyle({
          color: ['#0066cc', '#0066cc', '#cc6600'][0], // Default to first color
          weight: 2,
          opacity: 1.0,
          fillOpacity: 0.2,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: null // Explicitly remove dashed border
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

  const unionHandlerRef = useRef<any>(null);

  const triggerUnion = () => {
    console.log('Tick button clicked, triggering union...');
    console.log('UnionHandler ref:', unionHandlerRef.current);
    console.log('Selected polygons count:', selectedPolygons.length);
    
    if (selectedPolygons.length === 0) return;
    
    // Calculate remaining polygons (not selected)
    const remaining = layers.filter(layer => !selectedPolygons.includes(layer));
    setRemainingPolygons(remaining);
    console.log(`Separated ${selectedPolygons.length} selected polygons from ${remaining.length} remaining polygons`);
    
    if (unionHandlerRef.current) {
      unionHandlerRef.current.unionSelectedPolygons();
      // Disable drag selection mode after union
      setIsSelectionMode(false);
      // Re-enable map dragging
      if (map && map.dragging) {
        map.dragging.enable();
      }
      // Clear selection
      clearSelection();
    } else {
      console.error('UnionHandler ref is null!');
    }
  };

  const triggerSplit = () => {
    if (unionHandlerRef.current) {
      unionHandlerRef.current.splitUnionedLayer();
    }
  };

  const confirmPosition = () => {
    console.log('Confirming position and merging unioned polygon...');
    if (unionHandlerRef.current) {
      unionHandlerRef.current.confirmPosition();
    }
    
    // After position confirmation, merge remaining + transformed polygons
    if (onPositionConfirmed && remainingPolygons.length > 0) {
      onPositionConfirmed({
        transformedPolygons: [], // Will be filled by UnionHandler callback
        remainingPolygons: remainingPolygons,
        action: 'positionConfirmed'
      });
    }
  };

  const toggleSelectionMode = () => {
    const newMode = !isSelectionMode;
    setIsSelectionMode(newMode);
    
    // Notify parent of selection mode change
    if (onSelectionModeChange) {
      onSelectionModeChange(newMode);
    }
    
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
    if (!isSelectionMode) return;

    const polygonsInBounds: any[] = [];
    
    layers.forEach((layer) => {
      try {
        // Check if layer has getBounds method
        if (typeof layer.getBounds !== 'function') return;

        const layerBounds = layer.getBounds();
        
        // Check if bounds are valid
        if (!layerBounds || !layerBounds.isValid || !layerBounds.isValid()) return;

        const intersects = bounds.intersects(layerBounds);
        
        if (intersects) {
          polygonsInBounds.push(layer);
        }
      } catch (error) {
        console.error(`Error processing layer:`, error);
      }
    });

    // Add new selections
    polygonsInBounds.forEach((polygon) => {
      if (!selectedPolygons.includes(polygon)) {
        try {
          if (polygon.setStyle) {
            polygon.setStyle({
              color: '#ff0000',
              weight: 3,
              opacity: 1.0,
              fillOpacity: 0.3,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: '5, 5'
            });
          }
        } catch (styleError) {
          console.error('Error applying selection style:', styleError);
        }
      }
    });

    // Remove selections that are no longer in bounds
    selectedPolygons.forEach((polygon) => {
      if (!polygonsInBounds.includes(polygon)) {
        try {
          if (polygon.setStyle) {
            polygon.setStyle({
              color: '#0066cc', // Default blue color
              weight: 2,
              opacity: 1.0,
              fillOpacity: 0.2,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: null // Explicitly remove dashed border
            });
          }
        } catch (styleError) {
          console.error('Error removing selection style:', styleError);
        }
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
      
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) {
        return;
      }
      
      // Prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      
      // Get screen coordinates relative to map container
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Keep state for UI
      setDragEnd({ x, y });
      
      // Keep ref for reliable latest value
      dragEndRef.current = { x, y };
      
      // Update drag bounds using ref
      if (dragStartRef.current) {
        const left = Math.min(dragStartRef.current.x, x);
        const top = Math.min(dragStartRef.current.y, y);
        const width = Math.abs(x - dragStartRef.current.x);
        const height = Math.abs(y - dragStartRef.current.y);
        
        setDragBounds({ left, top, width, height });
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
      
      // Use refs instead of state (state may be stale)
      const start = dragStartRef.current;
      const end = dragEndRef.current;
      
      // Select polygons in bounds
      if (start && end) {
        // Convert screen coordinates to lat/lng
        const startLatLng = map.containerPointToLatLng([start.x, start.y]);
        const endLatLng = map.containerPointToLatLng([end.x, end.y]);
        const bounds = L.latLngBounds(startLatLng, endLatLng);
        
        
        selectPolygonsInBounds(bounds);
      }
      
      setDragStart(null);
      setDragEnd(null);
      setDragBounds(null);
      dragStartRef.current = null;
      dragEndRef.current = null;
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Right-click - clear all selections
      e.preventDefault();
      e.stopPropagation();
      
      clearSelection();
    };

    // Add event listeners to map container
    const mapContainer = map.getContainer();
    mapContainer.addEventListener('mousedown', handleMouseDown);
    mapContainer.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      // Clean up event listeners
      mapContainer.removeEventListener('mousedown', handleMouseDown);
      mapContainer.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
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
    return null;
  }

  return (
    <>
      {/* Dashed selection rectangle */}
      {isDragging && dragBounds && (
        <div
          className="absolute pointer-events-none z-[1003]"
          style={{
            left: `${dragBounds.left}px`,
            top: `${dragBounds.top}px`,
            width: `${Math.max(dragBounds.width, 1)}px`,
            height: `${Math.max(dragBounds.height, 1)}px`,
            border: '2px dashed #ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            minWidth: '1px',
            minHeight: '1px',
            position: 'absolute'
          }}
        />
      )}
      
      
      <div className="absolute top-4 left-20 z-[1002]">
        <div className="flex flex-col space-y-2">
        <button
          onClick={toggleSelectionMode}
          className={`flex items-center justify-center w-10 h-10 rounded-md transition-colors text-sm shadow-lg ${
            isSelectionMode 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSelectionMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" strokeDasharray="5,5" />
            </svg>
          )}
        </button>

        {/* Union/Split Button */}
        {selectedPolygons.length >= 2 && !unionedLayer && (
          <button
            onClick={triggerUnion}
            className="flex items-center justify-center w-10 h-10 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors text-sm shadow-lg"
            title="Union Selected Polygons"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}

        {/* Confirm Position Button */}
        {unionedLayer && !isPositionConfirmed && (
          <button
            onClick={confirmPosition}
            className="flex items-center justify-center w-10 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm shadow-lg"
            title="Confirm Position and Merge"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}

        {/* Split Button - Only show if position is NOT confirmed */}
        {unionedLayer && !isPositionConfirmed && (
          <button
            onClick={triggerSplit}
            className="flex items-center justify-center w-10 h-10 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors text-sm shadow-lg"
            title="Split Unioned Polygons"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        </div>
      </div>

      {/* Union Handler */}
      <UnionHandler 
        ref={unionHandlerRef}
        map={map}
        L={L}
        selectedPolygons={selectedPolygons}
        onUnionComplete={(unionLayer) => {
          setUnionedLayer(unionLayer);
          setIsPositionConfirmed(false);
          console.log('Union completed:', unionLayer);
        }}
        onSplitComplete={(individualLayers) => {
          setUnionedLayer(null);
          setIsPositionConfirmed(false);
          console.log('Split completed:', individualLayers);
        }}
        onPositionConfirmed={(positionedGeoJson) => {
          setIsPositionConfirmed(true);
          setUnionedLayer(null); // Clear unioned layer state
          
          // Notify parent that selection mode is ending
          if (onSelectionModeChange) {
            onSelectionModeChange(false);
          }
          
          // Merge remaining polygons with transformed polygons
          if (onPositionConfirmed && remainingPolygons.length > 0) {
            onPositionConfirmed({
              transformedPolygons: positionedGeoJson,
              remainingPolygons: remainingPolygons,
              action: 'positionConfirmed'
            });
          } else if (onPositionConfirmed) {
            onPositionConfirmed(positionedGeoJson);
          }
          
          // Clear remaining polygons state
          setRemainingPolygons([]);
          console.log('Position confirmed and merged');
        }}
      />
    </>
  );
}
