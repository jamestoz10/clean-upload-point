'use client';

import { useState } from 'react';
import UploadCard from '@/components/Upload/UploadCard';
import PostcodeCard from '@/components/Upload/Postcode';
import ContinueToMap from '@/components/Upload/Continuetomap';
import Slicer from '@/components/ui/Slicer';

export default function UploadPage() {
  const [fileType, setFileType] = useState('');
  const [hasImageFiles, setHasImageFiles] = useState(false);
  const [hasVectorFiles, setHasVectorFiles] = useState(false);
  const [hasPostcode, setHasPostcode] = useState(false);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);

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
          <div className="mt-6">
            <ContinueToMap 
              isVisible={true}
              uploadedCount={uploadedFileCount}
            />
          </div>
        )}
      </div>
    </div>
  );
}
