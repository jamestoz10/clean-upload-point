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
  combinedLineData: any;
  cleanedData: any;
}

interface MapPageActions {
  handleMapReady: (map: any, L: any) => void;
  handleFlattenComplete: (flattenedResult: any) => void;
  isMapReadyForLayers: () => boolean;
  setCombinedLineData: (data: any) => void;
  setCleanedData: (data: any) => void;
}

export function useMapPageState() {
  // State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<any>(null);
  const [vectorData, setVectorData] = useState<any>(null);
  const [unionedGeoJsonData, setUnionedGeoJsonData] = useState<any>(null);
  const [flattenedGeoJsonData, setFlattenedGeoJsonData] = useState<any>(null);
  const [processedImageId, setProcessedImageId] = useState<string | null>(null);
  const [combinedLineData, setCombinedLineData] = useState<any>(null);
  const [cleanedData, setCleanedData] = useState<any>(null);
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
                // Check if user selected "No" for vector quality (line-only processing)
                const vectorQualitySelection = localStorage.getItem('vector-quality-selection');
                const isLineOnly = vectorQualitySelection === 'false';
                
                let processedGeoJsonData: any;
                
                if (isLineOnly) {
                  // Skip polygon processing, use raw GeoJSON for line-only processing
                  console.log('Line-only mode: Skipping polygon visibility processing');
                  processedGeoJsonData = geoJsonData;
                  
                  // Process line-only data immediately
                  const processLineOnlyData = async () => {
                    try {
                      // Filter out polygons, keep only LineString features
                      const lineOnlyFeatures = processedGeoJsonData.features.filter((feature: any) => 
                        feature.geometry && feature.geometry.type === 'LineString'
                      );

                      console.log(`Filtered from ${processedGeoJsonData.features.length} to ${lineOnlyFeatures.length} LineString features`);

                      if (lineOnlyFeatures.length === 0) {
                        console.warn('No LineString features found for line-only processing');
                        return;
                      }

                      // Combine LineStrings into MultiLineString
                      const { combine, flatten, featureCollection } = await import('@turf/turf');
                      
                      // For large datasets, process in batches
                      const BATCH_SIZE = 1000;
                      const allCoordinates: number[][][] = [];
                      
                      if (lineOnlyFeatures.length > BATCH_SIZE) {
                        console.log(`Large dataset detected (${lineOnlyFeatures.length} features), processing in batches of ${BATCH_SIZE}`);
                        
                        for (let i = 0; i < lineOnlyFeatures.length; i += BATCH_SIZE) {
                          const batch = lineOnlyFeatures.slice(i, i + BATCH_SIZE);
                          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(lineOnlyFeatures.length / BATCH_SIZE)}`);
                          
                          try {
                            const batchCombined = combine(batch);
                            if (batchCombined && batchCombined.features && batchCombined.features.length > 0) {
                              batchCombined.features.forEach((feature: any) => {
                                if (feature.geometry.type === 'MultiLineString') {
                                  allCoordinates.push(...feature.geometry.coordinates);
                                } else if (feature.geometry.type === 'LineString') {
                                  allCoordinates.push(feature.geometry.coordinates);
                                }
                              });
                            } else {
                              // Fallback: extract coordinates directly
                              batch.forEach((feature: any) => {
                                if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                                  allCoordinates.push(feature.geometry.coordinates);
                                }
                              });
                            }
                          } catch (batchError) {
                            console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, using fallback:`, batchError);
                            batch.forEach((feature: any) => {
                              if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                                allCoordinates.push(feature.geometry.coordinates);
                              }
                            });
                          }
                        }
                      } else {
                        // For smaller datasets, use turf.combine normally
                        try {
                          const combined = combine(lineOnlyFeatures);
                          if (combined && combined.features && combined.features.length > 0) {
                            combined.features.forEach((feature: any) => {
                              if (feature.geometry.type === 'MultiLineString') {
                                allCoordinates.push(...feature.geometry.coordinates);
                              } else if (feature.geometry.type === 'LineString') {
                                allCoordinates.push(feature.geometry.coordinates);
                              }
                            });
                          } else {
                            // Fallback: extract coordinates directly
                            lineOnlyFeatures.forEach((feature: any) => {
                              if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                                allCoordinates.push(feature.geometry.coordinates);
                              }
                            });
                          }
                        } catch (combineError) {
                          console.warn('turf.combine failed, using fallback:', combineError);
                          lineOnlyFeatures.forEach((feature: any) => {
                            if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                              allCoordinates.push(feature.geometry.coordinates);
                            }
                          });
                        }
                      }

                      if (allCoordinates.length === 0) {
                        console.warn('No valid LineString coordinates found');
                        return;
                      }

                      // Create single MultiLineString feature
                      const combinedLineData = {
                        type: 'FeatureCollection',
                        features: [{
                          type: 'Feature',
                          geometry: {
                            type: 'MultiLineString',
                            coordinates: allCoordinates
                          },
                          properties: {}
                        }]
                      };

                      console.log('Created combined MultiLineString with', allCoordinates.length, 'line segments');
                      
                      // Clean the combined line data with turf.cleanCoords (designed for all geometry types)
                      const { cleanCoords } = await import('@turf/turf');
                      
                      try {
                        const cleanedFeature = cleanCoords(combinedLineData.features[0]);
                        
                        const cleanedData = {
                          type: 'FeatureCollection',
                          features: [cleanedFeature]
                        };
                        
                        console.log('Line data cleaned successfully with turf.cleanCoords');
                        
                        // Set both the combined and cleaned line data
                        console.log('Setting combinedLineData:', combinedLineData);
                        setCombinedLineData(combinedLineData);
                        console.log('Setting cleanedData:', cleanedData);
                        setCleanedData(cleanedData);
                      } catch (cleanError) {
                        console.warn('Error cleaning line data with turf.cleanCoords, using original:', cleanError);
                        // Fallback to original combined data
                        setCombinedLineData(combinedLineData);
                        setCleanedData(combinedLineData);
                      }
                      
                    } catch (error) {
                      console.error('Error processing line-only data:', error);
                    }
                  };

                  // Process the line-only data and wait for completion
                  await processLineOnlyData();
                  
                  // Don't set unionedGeoJsonData - we're using combinedLineData instead
                  return;
                } else {
                  // Normal polygon processing flow - clear any leftover line-only data
                  localStorage.removeItem('temp-line-data');
                  localStorage.removeItem('combined-line-data');
                  
                  const { processOverlappingPolygons } = await import('@/utils/polygonVisibility');
                  processedGeoJsonData = processOverlappingPolygons(geoJsonData, {
                    orderBy: 'z',
                    minCoveredPct: 10,
                    clipRemainder: true
                  });
                }
                
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

  // Load combinedLineData from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedCombinedLineData = localStorage.getItem('combined-line-data');
    if (storedCombinedLineData) {
      try {
        const parsedData = JSON.parse(storedCombinedLineData);
        setCombinedLineData(parsedData);
      } catch (error) {
        console.error('Error parsing combined line data from localStorage:', error);
      }
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
    fileType,
    combinedLineData,
    cleanedData
  };

  const actions: MapPageActions = {
    handleMapReady,
    handleFlattenComplete,
    isMapReadyForLayers,
    setCombinedLineData,
    setCleanedData
  };

  return { state, actions };
}
