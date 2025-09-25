'use client';

import { useState, useEffect } from 'react';

interface LineOnlyProcessorProps {
  geoJsonData: any; // Processed GeoJSON data from map state
  onProcessedData: (processedData: any) => void;
}

export default function LineOnlyProcessor({ geoJsonData, onProcessedData }: LineOnlyProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-process when geoJsonData changes
  useEffect(() => {
    if (geoJsonData) {
      processGeoJSON();
    }
  }, [geoJsonData]);

  const processGeoJSON = async () => {
    setIsProcessing(true);
    
    try {
      console.log('Processing GeoJSON for line-only:', geoJsonData);
      
      if (!geoJsonData || !geoJsonData.features) {
        console.warn('Invalid GeoJSON data structure');
        setIsProcessing(false);
        return;
      }

      // Filter out polygons, keep only LineString features
      const lineOnlyFeatures = geoJsonData.features.filter((feature: any) => 
        feature.geometry && feature.geometry.type === 'LineString'
      );

      const processedData = {
        type: 'FeatureCollection',
        features: lineOnlyFeatures
      };

      console.log(`Filtered from ${geoJsonData.features.length} to ${lineOnlyFeatures.length} LineString features`);
      onProcessedData(processedData);
      
    } catch (error) {
      console.error('Error fetching or processing GeoJSON:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-orange-800">
            Line-Only Processing
          </h3>
          <p className="text-xs text-orange-600 mt-1">
            {isProcessing ? 'Processing...' : 'Removing polygons and keeping only line features'}
          </p>
        </div>
        {isProcessing && (
          <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  );
}
