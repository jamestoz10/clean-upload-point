import { useState, useEffect, useCallback } from 'react';

interface MapLayer {
  id: string;
  type: 'image' | 'vector';
  url?: string;
  data?: any;
  bounds?: [[number, number], [number, number]];
  opacity?: number;
  name: string;
}

interface MapState {
  center: [number, number];
  zoom: number;
  layers: MapLayer[];
  projectName: string;
  lastSaved: number;
}

const STORAGE_KEY = 'cad-upload-map-state';

export function useMapState() {
  const [mapState, setMapState] = useState<MapState>({
    center: [0, 0], // Default to world center, will be updated by postcode or user interaction
    zoom: 2, // World view zoom level
    layers: [],
    projectName: 'Untitled Project',
    lastSaved: Date.now()
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMapState(parsed);
      } catch (error) {
        console.error('Failed to load map state:', error);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const stateToSave = {
      ...mapState,
      lastSaved: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [mapState]);

  const addLayer = useCallback((layer: Omit<MapLayer, 'id'>) => {
    const newLayer = {
      ...layer,
      id: Date.now().toString()
    };
    setMapState(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer]
    }));
  }, []);

  const removeLayer = useCallback((id: string) => {
    setMapState(prev => ({
      ...prev,
      layers: prev.layers.filter(layer => layer.id !== id)
    }));
  }, []);

  const updateMapView = useCallback((center: [number, number], zoom: number) => {
    setMapState(prev => ({
      ...prev,
      center,
      zoom
    }));
  }, []);

  const clearAllLayers = useCallback(() => {
    setMapState(prev => ({
      ...prev,
      layers: []
    }));
  }, []);

  return {
    mapState,
    addLayer,
    removeLayer,
    updateMapView,
    clearAllLayers
  };
}