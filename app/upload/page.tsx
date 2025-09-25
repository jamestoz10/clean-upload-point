'use client';

import { useState, useEffect } from 'react';
import UploadCard from '@/components/Upload/UploadCard';
import PostcodeCard from '@/components/Upload/Postcode';
import ContinueToMap from '@/components/Upload/Continuetomap';
import VectorQuality from '@/components/Upload/VectorQuality';
import Slicer from '@/components/ui/Slicer';

export default function UploadPage() {
  const [fileType, setFileType] = useState('');
  const [hasImageFiles, setHasImageFiles] = useState(false);
  const [hasVectorFiles, setHasVectorFiles] = useState(false);
  const [hasPostcode, setHasPostcode] = useState(false);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const [isVectorClean, setIsVectorClean] = useState<boolean | null>(null);
  const [hasDwgDxfFiles, setHasDwgDxfFiles] = useState(false);

  // Store vector quality selection in localStorage
  useEffect(() => {
    if (isVectorClean !== null) {
      localStorage.setItem('vector-quality-selection', JSON.stringify(isVectorClean));
    }
  }, [isVectorClean]);

  const fileTypeOptions = [
    { value: 'image', label: 'Image' },
    { value: 'vector', label: 'Vector' },
    { value: 'document', label: 'Document' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-900 mb-8 text-center">
          Upload Files
        </h1>
        
        <div className="mb-6">
          <Slicer
            options={fileTypeOptions}
            selectedValue={fileType}
            onValueChange={setFileType}
            placeholder="Select file type"
            label="File Type"
            className="max-w-xs"
          />
        </div>
        
        <UploadCard 
          fileType={fileType} 
          onImageFilesChange={setHasImageFiles}
          onVectorFilesChange={setHasVectorFiles}
          onUploadedFilesChange={setUploadedFileCount}
          onDwgDxfFilesChange={setHasDwgDxfFiles}
          isVectorClean={isVectorClean}
        />
        
        {(fileType === 'image' && hasImageFiles) && (
          <div className="mt-6">
            <PostcodeCard onPostcodeChange={setHasPostcode} />
            
            {uploadedFileCount > 0 && hasPostcode && (
              <div className="mt-4">
                <ContinueToMap 
                  isVisible={true}
                  uploadedCount={uploadedFileCount}
                />
              </div>
            )}
          </div>
        )}
        
        {fileType === 'vector' && hasVectorFiles && uploadedFileCount > 0 && (
          <div className="mt-6 space-y-4">
            {hasDwgDxfFiles && (
              <VectorQuality 
                isVectorClean={isVectorClean}
                onVectorCleanChange={setIsVectorClean}
              />
            )}
            
            {hasDwgDxfFiles && isVectorClean === false && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-orange-800">
                      Line-Only Processing Ready
                    </h3>
                    <p className="text-xs text-orange-600 mt-1">
                      Vector file will be processed to lines-only on the map
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <ContinueToMap 
              isVisible={true}
              uploadedCount={uploadedFileCount}
              isVectorClean={hasDwgDxfFiles ? isVectorClean : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
