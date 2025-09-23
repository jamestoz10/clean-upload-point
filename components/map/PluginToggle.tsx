'use client';

import ImageOverlay from './Image/ImageOverlay';
import VectorLayer from './Vector/VectorLayer';

interface PluginToggleProps {
  map: any;
  L: any;
  imageData?: any;
  vectorData?: any;
  imageUrl?: string;
}

export default function PluginToggle({ map, L, imageData, vectorData, imageUrl }: PluginToggleProps) {
  // Determine which component to render based on available data
  const hasImage = imageData && imageUrl && imageData.fileName?.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);
  const hasVector = vectorData && (vectorData.geoJsonUrl || vectorData.geoJsonData || 
    (vectorData.url && vectorData.fileName?.match(/\.(dxf|geojson)$/i)));

  // Render both ImageOverlay and VectorLayer based on available data
  return (
    <>
      {hasImage && (
        <ImageOverlay 
          map={map} 
          L={L}
          imageData={imageData}
          imageUrl={imageUrl!}
        />
      )}
      {hasVector && (
        <VectorLayer 
          map={map} 
          vectorData={vectorData}
          L={L} 
        />
      )}
    </>
  );
}
