'use client';

import { useState, useEffect } from 'react';
import { combine } from '@turf/turf';

interface LineCombinerProps {
  lineOnlyGeoJsonData: any; // GeoJSON data with only LineString features
  onCombinedData: (combinedData: any) => void;
}

export default function LineCombiner({ lineOnlyGeoJsonData, onCombinedData }: LineCombinerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [combinedResult, setCombinedResult] = useState<any>(null);

  // Auto-process when lineOnlyGeoJsonData changes
  useEffect(() => {
    if (lineOnlyGeoJsonData) {
      combineLineStrings();
    }
  }, [lineOnlyGeoJsonData]);

  const combineLineStrings = async () => {
    if (!lineOnlyGeoJsonData || !lineOnlyGeoJsonData.features) {
      console.warn('No LineString data to combine');
      return;
    }

    setIsProcessing(true);

    try {
      // Filter to ensure we only have LineString features
      const lineStringFeatures = lineOnlyGeoJsonData.features.filter((feature: any) => 
        feature.geometry && feature.geometry.type === 'LineString'
      );

      if (lineStringFeatures.length === 0) {
        console.warn('No LineString features found to combine');
        setIsProcessing(false);
        return;
      }

      // Debug: Check the structure of the first few LineString features
      console.log('Sample LineString features:', lineStringFeatures.slice(0, 3));
      console.log('First feature geometry:', lineStringFeatures[0]?.geometry);
      console.log('First feature coordinates:', lineStringFeatures[0]?.geometry?.coordinates);
      console.log('First feature coordinates length:', lineStringFeatures[0]?.geometry?.coordinates?.length);

      console.log(`Combining ${lineStringFeatures.length} LineString features into MultiLineString`);

      // For large datasets, process in batches to avoid memory issues
      const BATCH_SIZE = 1000;
      const allCoordinates: number[][][] = [];
      
      if (lineStringFeatures.length > BATCH_SIZE) {
        console.log(`Large dataset detected (${lineStringFeatures.length} features), processing in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < lineStringFeatures.length; i += BATCH_SIZE) {
          const batch = lineStringFeatures.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(lineStringFeatures.length / BATCH_SIZE)}`);
          
          try {
            const batchCombined = combine(batch);
            console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} combine result:`, batchCombined);
            
            if (batchCombined && batchCombined.features && batchCombined.features.length > 0) {
              batchCombined.features.forEach((feature: any) => {
                if (feature.geometry.type === 'MultiLineString') {
                  allCoordinates.push(...feature.geometry.coordinates);
                } else if (feature.geometry.type === 'LineString') {
                  allCoordinates.push(feature.geometry.coordinates);
                }
              });
              console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} successfully combined, added ${batchCombined.features.length} features`);
            } else {
              console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} combine returned no features, using fallback`);
              throw new Error('Combine returned no features');
            }
          } catch (batchError) {
            console.warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, falling back to direct coordinate extraction:`, batchError);
            // Fallback: extract coordinates directly without combining
            batch.forEach((feature: any) => {
              if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
                console.log('Adding coordinates from feature:', feature.geometry.coordinates.length, 'points');
                allCoordinates.push(feature.geometry.coordinates);
              } else {
                console.warn('Invalid feature structure:', feature);
              }
            });
          }
        }
      } else {
        // For smaller datasets, use turf.combine normally
        try {
          const combined = combine(lineStringFeatures);
          console.log('Small dataset combine result:', combined);
          
          if (combined && combined.features && combined.features.length > 0) {
            combined.features.forEach((feature: any) => {
              if (feature.geometry.type === 'MultiLineString') {
                allCoordinates.push(...feature.geometry.coordinates);
              } else if (feature.geometry.type === 'LineString') {
                allCoordinates.push(feature.geometry.coordinates);
              }
            });
            console.log(`Small dataset successfully combined, added ${combined.features.length} features`);
          } else {
            console.warn('Small dataset combine returned no features, using fallback');
            throw new Error('Combine operation returned no features');
          }
        } catch (combineError) {
          console.warn('turf.combine failed, falling back to direct coordinate extraction:', combineError);
          // Fallback: extract coordinates directly without combining
          lineStringFeatures.forEach((feature: any) => {
            if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
              console.log('Adding coordinates from feature:', feature.geometry.coordinates.length, 'points');
              allCoordinates.push(feature.geometry.coordinates);
            } else {
              console.warn('Invalid feature structure:', feature);
            }
          });
        }
      }

      console.log(`Collected ${allCoordinates.length} coordinate arrays from ${lineStringFeatures.length} LineString features`);
      
      if (allCoordinates.length === 0) {
        throw new Error('No valid LineString coordinates found');
      }

      const singleMultiLineString = {
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

      console.log('Single MultiLineString created with', allCoordinates.length, 'line segments');

      // Store result
      setCombinedResult(singleMultiLineString);

      // Notify parent component
      onCombinedData(singleMultiLineString);

    } catch (error) {
      console.error('Error combining LineStrings:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Line Combiner
          </h3>
          <p className="text-xs text-blue-600 mt-1">
            {isProcessing ? 'Combining LineStrings...' : 'Combining LineStrings into MultiLineString'}
          </p>
          {lineOnlyGeoJsonData && lineOnlyGeoJsonData.features && (
            <p className="text-xs text-blue-500 mt-1">
              {lineOnlyGeoJsonData.features.length} LineString features ready
            </p>
          )}
        </div>
        {isProcessing && (
          <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        )}
      </div>
      
      {combinedResult && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-600">
              Combined to {combinedResult.features.length} MultiLineString feature(s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
