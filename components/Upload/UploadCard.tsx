'use client';

import { useState, useEffect } from 'react';

interface UploadCardProps {
  fileType?: string;
  onImageFilesChange?: (hasImageFiles: boolean) => void;
  onVectorFilesChange?: (hasVectorFiles: boolean) => void;
  onUploadedFilesChange?: (count: number) => void;
}

interface UploadResult {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
  geoJsonUrl?: string;
  dwgUrl?: string;
  originalFileName?: string;
  uploadedToAzure?: boolean;
  dwgUploaded?: boolean;
  convertedToGeoJSON?: boolean;
}

export default function UploadCard({ fileType = '', onImageFilesChange, onVectorFilesChange, onUploadedFilesChange }: UploadCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  // Reset file states when file type changes
  useEffect(() => {
    if (onImageFilesChange) {
      onImageFilesChange(false);
    }
    if (onVectorFilesChange) {
      onVectorFilesChange(false);
    }
    if (onUploadedFilesChange) {
      onUploadedFilesChange(0);
    }
  }, [fileType, onImageFilesChange, onVectorFilesChange, onUploadedFilesChange]);

  // Notify parent when uploaded files count changes
  useEffect(() => {
    if (onUploadedFilesChange) {
      onUploadedFilesChange(uploadedFiles.size);
    }
  }, [uploadedFiles.size, onUploadedFilesChange]);

  const getAcceptTypes = () => {
    switch (fileType) {
      case 'image':
        return '.jpg,.jpeg,.png';
      case 'vector':
        return '.dwg,.dxf,.geojson,.shp,.kml';
      case 'document':
        return '.pdf';
      default:
        return '.dwg,.dxf,.pdf,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.svg';
    }
  };

  const getFileTypeDescription = () => {
    switch (fileType) {
      case 'image':
        return 'JPG, PNG files';
      case 'vector':
        return 'DWG, DXF, GeoJSON, Shapefile, KML files';
      case 'document':
        return 'PDF files';
      default:
        return 'DWG, DXF, PDF, JPG, PNG, GIF, BMP, TIFF, SVG files';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // Clear existing files and set new ones
      setSelectedFiles(fileArray);
      setUploadedFiles(new Set());
      
      // Check if any of the selected files are images
      const hasImageFiles = fileArray.some(file => 
        file.type.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i.test(file.name)
      );
      
      // Check if any of the selected files are vectors
      const hasVectorFiles = fileArray.some(file => 
        /\.(dwg|dxf|geojson|shp|kml)$/i.test(file.name)
      );
      
      // Notify parent component about file types
      if (onImageFilesChange) {
        onImageFilesChange(hasImageFiles);
      }
      if (onVectorFilesChange) {
        onVectorFilesChange(hasVectorFiles);
      }
      
      // Automatically upload the new files
      await uploadFiles(fileArray);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadedFiles(prev => new Set(prev));
    setUploadProgress({});

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      
      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [fileName]: 0,
      }));

      try {
        const result = await uploadFile(file);
        
        if (result.success) {
          // Add to uploaded files set
          setUploadedFiles(prev => new Set([...prev, fileName]));
          
          // Store upload data for map page
          if (result.url) {
            const uploadedImages = JSON.parse(localStorage.getItem('uploaded-images') || '[]');
            uploadedImages.push({
              url: result.url,
              fileName: result.fileName || fileName,
              uploadedAt: Date.now(),
              // Include additional data from API response
              geoJsonUrl: result.geoJsonUrl,
              dwgUrl: result.dwgUrl,
              originalFileName: result.originalFileName,
              uploadedToAzure: result.uploadedToAzure,
              dwgUploaded: result.dwgUploaded,
              convertedToGeoJSON: result.convertedToGeoJSON
            });
            localStorage.setItem('uploaded-images', JSON.stringify(uploadedImages));
          }
        }
        
        // Update progress to 100%
        setUploadProgress(prev => ({
          ...prev,
          [fileName]: 100,
        }));
      } catch (error) {
        // Upload failed, don't add to uploaded files
      }
    }

    setIsUploading(false);
  };

  const uploadFile = async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    // Check if it's a DWG file that needs conversion
    const isDwgFile = file.name.toLowerCase().endsWith('.dwg');
    const apiEndpoint = isDwgFile ? '/api/convert-dwg' : '/api/upload';

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          url: result.url,
          fileName: result.fileName || result.originalFileName || file.name,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Upload failed',
          fileName: file.name,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        fileName: file.name,
      };
    }
  };


  return (
    <div className="space-y-6">
      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-200 ${
        !fileType 
          ? 'border-gray-200 bg-gray-50' 
          : 'border-gray-300 hover:border-blue-400'
      }`}>
        <input
          type="file"
          accept={getAcceptTypes()}
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={isUploading || !fileType}
          multiple
        />
        <label 
          htmlFor="file-upload" 
          className={`block ${!fileType ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <div className="space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center shadow-inner ${
              !fileType 
                ? 'bg-gradient-to-br from-gray-100 to-gray-200' 
                : 'bg-gradient-to-br from-blue-100 to-red-100'
            }`}>
              {isUploading ? (
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              ) : !fileType ? (
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <div>
              {!fileType ? (
                <div>
                  <p className="text-base text-gray-500">
                    <span className="font-semibold">Please select a file type first</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-1">Choose a file type from the dropdown above</p>
                </div>
              ) : (
                <div>
                  <p className="text-base text-gray-700">
                    <span className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                      {selectedFiles.length > 0 ? 'Click to upload different files' : 'Click to upload'}
                    </span>{' '}
                    {selectedFiles.length === 0 && 'or drag and drop'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{getFileTypeDescription()}</p>
                </div>
              )}
            </div>
          </div>
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="space-y-2">
            {selectedFiles.map((file, index) => {
              const isUploaded = uploadedFiles.has(file.name);
              return (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      isUploaded ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {isUploaded ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
