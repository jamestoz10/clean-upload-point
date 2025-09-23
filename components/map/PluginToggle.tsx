'use client';

import ImageOverlay from './ImageOverlay';
import VectorLayer from './VectorLayer';

interface PluginToggleProps {
  map: any;
  L: any;
  imageData?: any;
  vectorData?: any;
  imageUrl?: string;
}

export default function PluginToggle({ map, L, imageData, vectorData, imageUrl }: PluginToggleProps) {
  // Determine which component to render based on available data
  const hasImage = imageData && imageUrl;
  const hasVector = vectorData && (vectorData.geoJsonUrl || vectorData.geoJsonData || 
    (vectorData.url && vectorData.fileName?.match(/\.(dxf|geojson)$/i)));

  console.log('PluginToggle - Props received:', { map: !!map, L: !!L, imageData, vectorData, imageUrl });
  console.log('PluginToggle - hasImage:', hasImage, 'hasVector:', hasVector);
  console.log('PluginToggle - vectorData details:', vectorData);

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
