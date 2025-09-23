'use client';

import { useState } from 'react';
import { useMapState } from '@/hooks/useMapState';

interface PostcodeCardProps {
  onLocationUpdate?: (lat: number, lng: number) => void;
  onPostcodeChange?: (hasPostcode: boolean) => void;
  className?: string;
}

export default function PostcodeCard({ onLocationUpdate, onPostcodeChange, className = '' }: PostcodeCardProps) {
  const [postcode, setPostcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { updateMapView } = useMapState();

  const geocodePostcode = async (postcode: string): Promise<{ lat: number; lng: number }> => {
    // Clean the postcode - remove spaces and convert to uppercase
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
    
    // Use Nominatim API (free OpenStreetMap geocoding service)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanPostcode)}&countrycodes=gb&limit=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch coordinates');
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('Postcode not found');
    }
    
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postcode.trim()) {
      setError('Please enter a postcode');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const coords = await geocodePostcode(postcode);
      setCoordinates(coords);
      
      // Update map view
      updateMapView([coords.lat, coords.lng], 15);
      
      // Call the optional callback
      if (onLocationUpdate) {
        onLocationUpdate(coords.lat, coords.lng);
      }
      
      // Store coordinates with uploaded images
      const uploadedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
      if (uploadedImages.length > 0) {
        // Update the latest image with postcode coordinates
        const latestImageIndex = uploadedImages.length - 1;
        uploadedImages[latestImageIndex] = {
          ...uploadedImages[latestImageIndex],
          postcodeCoordinates: coords,
          postcode: postcode
        };
        localStorage.setItem('uploaded-images', JSON.stringify(uploadedImages));
      }
      
      // Notify parent that postcode has been entered
      if (onPostcodeChange) {
        onPostcodeChange(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find postcode');
      setCoordinates(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPostcode('');
    setCoordinates(null);
    setError(null);
    
    // Clear postcode coordinates from uploaded images
    const uploadedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
    if (uploadedImages.length > 0) {
      const latestImageIndex = uploadedImages.length - 1;
      uploadedImages[latestImageIndex] = {
        ...uploadedImages[latestImageIndex],
        postcodeCoordinates: null,
        postcode: null
      };
      localStorage.setItem('uploaded-images', JSON.stringify(uploadedImages));
    }
    
    // Notify parent that postcode has been cleared
    if (onPostcodeChange) {
      onPostcodeChange(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 p-4 ${className}`}>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Find Location by Postcode</h3>
        <p className="text-xs text-gray-600">
          Enter a UK postcode to center the map on that location
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="postcode" className="block text-xs font-medium text-gray-700 mb-1">
            Postcode
          </label>
          <input
            type="text"
            id="postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="e.g., SW1A 1AA"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </div>
        )}

        {coordinates && (
          <div className="text-green-600 text-xs bg-green-50 border border-green-200 rounded-md p-2">
            <div className="font-medium">Location found:</div>
            <div>Lat: {coordinates.lat.toFixed(4)}</div>
            <div>Lng: {coordinates.lng.toFixed(4)}</div>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isLoading || !postcode.trim()}
            className="flex-1 bg-blue-600 text-white py-1.5 px-3 text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Finding...
              </div>
            ) : (
              'Find Location'
            )}
          </button>
          
          {coordinates && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
