import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';

export interface UploadResult {
  success: boolean;
  blobUrl?: string;
  blobName?: string;
  error?: string;
}

export async function uploadToAzureBlob(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  containerName: string = 'cad-uploads'
): Promise<UploadResult> {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      return {
        success: false,
        error: 'Azure storage connection string not configured'
      };
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists();
    
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    // Upload the buffer
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType
      }
    });
    
    return {
      success: true,
      blobUrl: blockBlobClient.url,
      blobName: fileName
    };
    
  } catch (error: any) {
    console.error('Azure Blob Storage upload error:', error);
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
}
