'use client';

import { useState, useEffect } from 'react';
import { cleanCoords } from '@turf/turf';

interface LineCleanerProps {
  combinedLineData: any; // Combined MultiLineString data from LineCombiner
  onCleanedData: (cleanedData: any) => void;
}

export default function LineCleaner({ combinedLineData, onCleanedData }: LineCleanerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanedResult, setCleanedResult] = useState<any>(null);

  // Auto-process when combinedLineData changes
  useEffect(() => {
    if (combinedLineData) {
      cleanLineData();
    }
  }, [combinedLineData]);

  const cleanLineData = async () => {
    if (!combinedLineData || !combinedLineData.features) {
      console.warn('No combined line data to clean');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Cleaning combined line data with turf.cleanCoords');
      
      // Clean each feature in the combined line data
      const cleanedFeatures = combinedLineData.features.map((feature: any) => {
        try {
          // Clean the coordinates using turf.cleanCoords
          const cleanedFeature = cleanCoords(feature);
          
          console.log(`Cleaned feature: ${feature.geometry.type} with ${feature.geometry.coordinates.length} line segments`);
          
          return cleanedFeature;
        } catch (error) {
          console.warn('Error cleaning feature, using original:', error);
          return feature; // Fallback to original if cleaning fails
        }
      });

      const cleanedData = {
        type: 'FeatureCollection',
        features: cleanedFeatures
      };

      console.log('Line data cleaned successfully');
      console.log(`Cleaned ${cleanedFeatures.length} features`);

      // Store result
      setCleanedResult(cleanedData);

      // Notify parent component
      onCleanedData(cleanedData);

    } catch (error) {
      console.error('Error cleaning line data:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-green-800">
            Line Cleaner
          </h3>
          <p className="text-xs text-green-600 mt-1">
            {isProcessing ? 'Cleaning coordinates...' : 'Cleaning coordinates with turf.cleanCoords'}
          </p>
          {combinedLineData && combinedLineData.features && (
            <p className="text-xs text-green-500 mt-1">
              {combinedLineData.features.length} MultiLineString features ready
            </p>
          )}
        </div>
        {isProcessing && (
          <div className="w-4 h-4 border-2 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        )}
      </div>
      
      {cleanedResult && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-600">Coordinates cleaned successfully</span>
          </div>
        </div>
      )}
    </div>
  );
}
