'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface MapPageState {
  imageUrl: string | null;
  imageData: any;
  vectorData: any;
  unionedGeoJsonData: any;
  flattenedGeoJsonData: any;
  processedImageId: string | null;
  mapInstance: any;
  leafletInstance: any;
  fileType: 'image' | 'vector' | 'both' | 'none';
}

interface MapPageActions {
  handleMapReady: (map: any, L: any) => void;
  handleFlattenComplete: (flattenedResult: any) => void;
  isMapReadyForLayers: () => boolean;
}

export function useMapPageState() {
  // State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<any>(null);
  const [vectorData, setVectorData] = useState<any>(null);
  const [unionedGeoJsonData, setUnionedGeoJsonData] = useState<any>(null);
  const [flattenedGeoJsonData, setFlattenedGeoJsonData] = useState<any>(null);
  const [processedImageId, setProcessedImageId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [leafletInstance, setLeafletInstance] = useState<any>(null);
  const [fileType, setFileType] = useState<'image' | 'vector' | 'both' | 'none'>('none');

  // Refs
  const processingRef = useRef<boolean>(false);
  const hasProcessedRef = useRef<Set<string>>(new Set());
  const imageDataRef = useRef<any>(null);

  // Helper function to check if map is truly ready for layers
  const isMapReadyForLayers = useCallback(() => {
    if (!mapInstance || !leafletInstance) return false;
    
    try {
      if (!mapInstance.getPane || !mapInstance.getContainer()) return false;
      
      const overlayPane = mapInstance.getPane('overlayPane');
      const markerPane = mapInstance.getPane('markerPane');
      
      return !!(overlayPane && markerPane);
    } catch (error) {
      return false;
    }
  }, [mapInstance, leafletInstance]);

  // Map ready handler
  const handleMapReady = useCallback((map: any, L: any) => {
    if (map && map.getPane && map.getContainer() && L) {
      setMapInstance(map);
      setLeafletInstance(L);
    }
  }, []);

  // Flatten complete handler
  const handleFlattenComplete = useCallback((flattenedResult: any) => {
    setFlattenedGeoJsonData(flattenedResult);
    
    const processedVectorData = {
      ...imageDataRef.current,
      geoJsonData: unionedGeoJsonData,
      geoJsonUrl: null
    };
    
    setVectorData(processedVectorData);
  }, [unionedGeoJsonData]);

  // Main effect for processing uploaded files
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const uploadedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
    
    if (uploadedImages.length > 0) {
      const latestImage = uploadedImages[uploadedImages.length - 1];
      
      const imageId = `${latestImage.url}-${latestImage.fileName}`;
      if (processedImageId === imageId || processingRef.current || hasProcessedRef.current.has(imageId)) {
        return;
      }
      
      processingRef.current = true;
      hasProcessedRef.current.add(imageId);
      
      if (latestImage.url) {
        setImageUrl(latestImage.url);
        setImageData(latestImage);
        imageDataRef.current = latestImage;
        
        if (latestImage.geoJsonUrl || latestImage.geoJsonData || latestImage.fileName?.match(/\.(dxf|geojson)$/i)) {
          const processVectorData = async () => {
            try {
              let geoJsonData: any;
              
              if (latestImage.geoJsonUrl) {
                const response = await fetch(latestImage.geoJsonUrl);
                geoJsonData = await response.json();
              } else if (latestImage.geoJsonData) {
                geoJsonData = latestImage.geoJsonData;
              } else if (latestImage.url && latestImage.fileName?.match(/\.dxf$/i)) {
                const response = await fetch(latestImage.url);
                const dxfContent = await response.text();
                const { parseDXFToGeoJSON } = await import('@/utils/dxfToGeoJSON');
                geoJsonData = parseDXFToGeoJSON(dxfContent);
              } else if (latestImage.url && latestImage.fileName?.match(/\.geojson$/i)) {
                const response = await fetch(latestImage.url);
                geoJsonData = await response.json();
              }
              
              if (geoJsonData) {
                const { processOverlappingPolygons } = await import('@/utils/polygonVisibility');
                const processedGeoJsonData = processOverlappingPolygons(geoJsonData, {
                  orderBy: 'z',
                  minCoveredPct: 10,
                  clipRemainder: true
                });
                
                const polygonFeatures = processedGeoJsonData.features.filter((feature: any) => 
                  feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
                );

                let unionedData;
                if (polygonFeatures.length === 0) {
                  unionedData = processedGeoJsonData;
                } else if (polygonFeatures.length === 1) {
                  unionedData = {
                    type: 'FeatureCollection',
                    features: [polygonFeatures[0]]
                  };
                } else {
                  const { union, featureCollection } = await import('@turf/turf');
                  const unionResult = union(featureCollection(polygonFeatures));
                  unionedData = {
                    type: 'FeatureCollection',
                    features: [unionResult]
                  };
                }
                
                setUnionedGeoJsonData(unionedData);
                setProcessedImageId(imageId);
                processingRef.current = false;
              } else {
                setVectorData(latestImage);
              }
            } catch (error) {
              setVectorData(latestImage);
              processingRef.current = false;
            }
          };
          
          processVectorData();
        }
        
        const hasImage = latestImage.url && latestImage.fileName?.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);
        const hasVector = latestImage.geoJsonUrl || latestImage.fileName?.match(/\.(dxf|geojson)$/i);
        
        if (hasImage && hasVector) {
          setFileType('both');
        } else if (hasVector) {
          setFileType('vector');
        } else if (hasImage) {
          setFileType('image');
        } else {
          setFileType('none');
        }
      }
    } else {
      setFileType('none');
    }
  }, []);

  // Return state and actions
  const state: MapPageState = {
    imageUrl,
    imageData,
    vectorData,
    unionedGeoJsonData,
    flattenedGeoJsonData,
    processedImageId,
    mapInstance,
    leafletInstance,
    fileType
  };

  const actions: MapPageActions = {
    handleMapReady,
    handleFlattenComplete,
    isMapReadyForLayers
  };

  return { state, actions };
}
