'use client';

import ImageOverlay from './Image/ImageOverlay';
import VectorLayer from './Vector/VectorLayer';

interface PluginToggleProps {
  map: any;
  L: any;
  imageData?: any;
  vectorData?: any;
  imageUrl?: string;
  combinedLineData?: any; // Combined MultiLineString data from LineCombiner
  cleanedData?: any; // Cleaned MultiLineString data with turf.cleanCoords applied
}

export default function PluginToggle({ map, L, imageData, vectorData, imageUrl, combinedLineData, cleanedData }: PluginToggleProps) {
  // Determine which component to render based on available data
  const hasImage = imageData && imageUrl && imageData.fileName?.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);
  
  // Check if we're in line-only mode
  const isLineOnly = typeof window !== 'undefined' && localStorage.getItem('vector-quality-selection') === 'false';
  
  // For vector rendering:
  // - If we have cleanedData, always render (line-only processing complete)
  // - If we're NOT in line-only mode, render normally
  // - If we're in line-only mode but no cleanedData yet, don't render (wait for processing)
  const hasVector = cleanedData || 
    (!isLineOnly && vectorData && (vectorData.geoJsonUrl || vectorData.geoJsonData || 
      (vectorData.url && vectorData.fileName?.match(/\.(dxf|geojson)$/i))));

  // Debug logging
  console.log('PluginToggle render check:', {
    isLineOnly,
    hasCombinedLineData: !!combinedLineData,
    hasCleanedData: !!cleanedData,
    hasVectorData: !!vectorData,
    hasVector,
    vectorQualitySelection: typeof window !== 'undefined' ? localStorage.getItem('vector-quality-selection') : 'N/A',
    cleanedDataFeatures: cleanedData?.features?.length,
    cleanedDataType: cleanedData?.type
  });

  // Render both ImageOverlay and VectorLayer based on available data
  return (
    <>
      {hasImage && (
        <ImageOverlay 
          map={map} 
          L={L}
          imageData={imageData}
          imageUrl={imageUrl!}
          postcodeCoordinates={imageData?.postcodeCoordinates}
        />
      )}
      {hasVector && (
        <VectorLayer 
          map={map} 
          vectorData={vectorData}
          L={L}
          combinedLineData={combinedLineData}
          cleanedData={cleanedData}
        />
      )}
    </>
  );
}
