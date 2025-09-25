'use client';

import { useEffect } from 'react';
import { useMapPageState } from '@/hooks/useMapPageState';
import MapContainer from '@/components/map/MapContainer';
import PluginToggle from '@/components/map/PluginToggle';
import TurfFlatten from '@/components/map/Vector/TurfFlatten';
import ClientOnly from '@/components/ui/ClientOnly';
import { useMapState } from '@/hooks/useMapState';

export default function MapPage() {
  const { state, actions } = useMapPageState();
  const { mapState, updateMapView } = useMapState();

  // Handle postcode centering when imageData changes
  useEffect(() => {
    if (state.imageData?.postcodeCoordinates) {
      updateMapView(
        [state.imageData.postcodeCoordinates.lat, state.imageData.postcodeCoordinates.lng],
        15
      );
    }
  }, [state.imageData, updateMapView]);

  return (
    <div className="h-screen w-full">
      <ClientOnly fallback={<div className="h-full w-full flex items-center justify-center">Loading map...</div>}>
        <MapContainer 
          className="h-full w-full" 
          center={state.imageData?.postcodeCoordinates ? 
            [state.imageData.postcodeCoordinates.lat, state.imageData.postcodeCoordinates.lng] : 
            mapState.center
          }
          zoom={state.imageData?.postcodeCoordinates ? 15 : mapState.zoom}
          fileType={state.fileType}
          onMapReady={actions.handleMapReady}
        />
      </ClientOnly>
      
      <ClientOnly>
        {state.mapInstance && state.leafletInstance && actions.isMapReadyForLayers() && (
          <>
            <PluginToggle 
              map={state.mapInstance} 
              L={state.leafletInstance}
              imageData={state.imageData}
              vectorData={state.vectorData}
              imageUrl={state.imageUrl || undefined}
              combinedLineData={state.combinedLineData}
              cleanedData={state.cleanedData}
            />
            {state.unionedGeoJsonData && (
              <TurfFlatten 
                map={state.mapInstance} 
                L={state.leafletInstance}
                unionedGeoJsonData={state.unionedGeoJsonData}
                onFlattenComplete={actions.handleFlattenComplete}
              />
            )}
            
            {/* Line-only processing is now handled directly in useMapPageState */}
          </>
        )}
      </ClientOnly>
      
    </div>
  );
}