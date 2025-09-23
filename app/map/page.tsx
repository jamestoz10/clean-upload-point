'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import MapContainer from '@/components/map/MapContainer';
import PluginToggle from '@/components/map/PluginToggle';
import TurfFlatten from '@/components/map/TurfFlatten';
import ClientOnly from '@/components/ui/ClientOnly';
import { useMapState } from '@/hooks/useMapState';

export default function MapPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<any>(null);
  const [vectorData, setVectorData] = useState<any>(null);
  const [unionedGeoJsonData, setUnionedGeoJsonData] = useState<any>(null);
  const [flattenedGeoJsonData, setFlattenedGeoJsonData] = useState<any>(null);
  const [processedImageId, setProcessedImageId] = useState<string | null>(null);
  const processingRef = useRef<boolean>(false);
  const hasProcessedRef = useRef<Set<string>>(new Set());
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [leafletInstance, setLeafletInstance] = useState<any>(null);
  const [fileType, setFileType] = useState<'image' | 'vector' | 'both' | 'none'>('none');
  const { mapState, updateMapView } = useMapState();

  // Helper function to check if map is truly ready for layers
  const isMapReadyForLayers = () => {
    if (!mapInstance || !leafletInstance) return false;
    
    try {
      // Check for basic map methods that are essential
      if (!mapInstance.getPane || !mapInstance.getContainer()) return false;
      
      const overlayPane = mapInstance.getPane('overlayPane');
      const markerPane = mapInstance.getPane('markerPane');
      
      return !!(overlayPane && markerPane);
    } catch (error) {
      return false;
    }
  };

  const handleMapReady = (map: any, L: any) => {
    if (map && map.getPane && map.getContainer() && L) {
      setMapInstance(map);
      setLeafletInstance(L);
    }
  };

  const imageDataRef = useRef<any>(null);
  
  const handleFlattenComplete = useCallback((flattenedResult: any) => {
    console.log('Flatten completed:', flattenedResult);
    setFlattenedGeoJsonData(flattenedResult);
    
    // Use unioned data instead of flattened data for VectorLayer
    const processedVectorData = {
      ...imageDataRef.current,
      geoJsonData: unionedGeoJsonData, // Use unioned data instead of flattened
      geoJsonUrl: null // Clear URL since we're using processed data
    };
    
    console.log('Setting vectorData with unioned polygons (not flattened):', processedVectorData);
    setVectorData(processedVectorData);
  }, [unionedGeoJsonData]); // Add unionedGeoJsonData as dependency

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('Map page useEffect running...', { processedImageId, processingRef: processingRef.current });
    const uploadedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
    
    if (uploadedImages.length > 0) {
      const latestImage = uploadedImages[uploadedImages.length - 1];
      
      // Prevent processing the same image multiple times
      const imageId = `${latestImage.url}-${latestImage.fileName}`;
      if (processedImageId === imageId || processingRef.current || hasProcessedRef.current.has(imageId)) {
        console.log('Image already processed or processing in progress, skipping...', { imageId, processedImageId, processing: processingRef.current, hasProcessed: hasProcessedRef.current.has(imageId) });
        return;
      }
      
      processingRef.current = true;
      hasProcessedRef.current.add(imageId);
      
      if (latestImage.url) {
        setImageUrl(latestImage.url);
        setImageData(latestImage);
        imageDataRef.current = latestImage; // Update ref
        
        // Check if this is a vector file (DXF/GeoJSON) or has GeoJSON data
        console.log('Latest image data:', latestImage);
        console.log('Has geoJsonUrl:', !!latestImage.geoJsonUrl);
        console.log('Has geoJsonData:', !!latestImage.geoJsonData);
        console.log('Filename:', latestImage.fileName);
        console.log('Is vector file:', latestImage.geoJsonUrl || latestImage.geoJsonData || latestImage.fileName?.match(/\.(dxf|geojson)$/i));
        
        if (latestImage.geoJsonUrl || latestImage.geoJsonData || latestImage.fileName?.match(/\.(dxf|geojson)$/i)) {
          // Process vector data with polygon visibility before setting
          const processVectorData = async () => {
            try {
              let geoJsonData: any;
              
              if (latestImage.geoJsonUrl) {
                console.log('Fetching from geoJsonUrl:', latestImage.geoJsonUrl);
                const response = await fetch(latestImage.geoJsonUrl);
                geoJsonData = await response.json();
              } else if (latestImage.geoJsonData) {
                console.log('Using geoJsonData directly:', latestImage.geoJsonData);
                geoJsonData = latestImage.geoJsonData;
              } else if (latestImage.url && latestImage.fileName?.match(/\.dxf$/i)) {
                const response = await fetch(latestImage.url);
                const dxfContent = await response.text();
                const { parseDXFToGeoJSON } = await import('@/utils/dxfToGeoJSON');
                geoJsonData = parseDXFToGeoJSON(dxfContent);
              } else if (latestImage.url && latestImage.fileName?.match(/\.geojson$/i)) {
                // Fallback: fetch GeoJSON from the main URL
                console.log('Fetching GeoJSON from main URL:', latestImage.url);
                const response = await fetch(latestImage.url);
                geoJsonData = await response.json();
              }
              
              if (geoJsonData) {
                // Apply polygon visibility processing
                const { processOverlappingPolygons } = await import('@/utils/polygonVisibility');
                const processedGeoJsonData = processOverlappingPolygons(geoJsonData, {
                  orderBy: 'z',
                  minCoveredPct: 10,
                  clipRemainder: true
                });
                
                // Union the processed polygons
                const polygonFeatures = processedGeoJsonData.features.filter((feature: any) => 
                  feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
                );

                let unionedData;
                if (polygonFeatures.length === 0) {
                  console.warn('No polygon features found after processing');
                  unionedData = processedGeoJsonData;
                } else if (polygonFeatures.length === 1) {
                  // Single feature - no union needed
                  unionedData = {
                    type: 'FeatureCollection',
                    features: [polygonFeatures[0]]
                  };
                } else {
                  // Multiple features - perform union
                  const { union, featureCollection } = await import('@turf/turf');
                  const unionResult = union(featureCollection(polygonFeatures));
                  unionedData = {
                    type: 'FeatureCollection',
                    features: [unionResult]
                  };
                }
                
                console.log('Unioned GeoJSON data:', unionedData);
                console.log('Unioned features count:', unionedData.features.length);
                console.log('Unioned geometry type:', unionedData.features[0]?.geometry?.type);
                
                // Store unioned data for flatten component
                setUnionedGeoJsonData(unionedData);
                
                // Mark this image as processed
                setProcessedImageId(imageId);
                processingRef.current = false;
                
                // Don't set vectorData yet - wait for flatten to complete
              } else {
                setVectorData(latestImage);
              }
            } catch (error) {
              console.error('Error processing vector data:', error);
              setVectorData(latestImage);
              processingRef.current = false;
            }
          };
          
          processVectorData();
        }
        
        // Determine file type for plugin loading
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
        
        // Update map center to postcode coordinates if available
        if (latestImage.postcodeCoordinates) {
          updateMapView(
            [latestImage.postcodeCoordinates.lat, latestImage.postcodeCoordinates.lng],
            15 // Higher zoom for postcode location
          );
        }
      }
    } else {
      setFileType('none');
    }
  }, []); // Empty dependency array - processing is controlled by refs

  return (
    <div className="h-screen w-full">
      <ClientOnly fallback={<div className="h-full w-full flex items-center justify-center">Loading map...</div>}>
        <MapContainer 
          className="h-full w-full" 
          center={mapState.center}
          zoom={mapState.zoom}
          fileType={fileType}
          onMapReady={handleMapReady}
        />
      </ClientOnly>
      
      <ClientOnly>
        {mapInstance && leafletInstance && isMapReadyForLayers() && (
          <>
            <PluginToggle 
              map={mapInstance} 
              L={leafletInstance}
              imageData={imageData}
              vectorData={vectorData}
              imageUrl={imageUrl || undefined}
            />
            {unionedGeoJsonData && (
              <TurfFlatten 
                map={mapInstance} 
                L={leafletInstance}
                unionedGeoJsonData={unionedGeoJsonData}
                onFlattenComplete={handleFlattenComplete}
              />
            )}
          </>
        )}
      </ClientOnly>
      
    </div>
  );
}