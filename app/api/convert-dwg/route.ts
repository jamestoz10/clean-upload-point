import { NextRequest } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import CloudConvert from 'cloudconvert';
import { uploadToAzureBlob } from '../../../utils/azureBlobStorage';
import { convertDXFBufferToGeoJSON } from '../../../utils/dxfToGeoJSON';

const cloudconvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY!);

async function readUpload(req: NextRequest): Promise<{ filePath: string; originalFileName: string }> {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dwg-'));
  const tmpFile = path.join(tmpDir, 'input.dwg');

  try {
    // Get the form data from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    // Convert File to Buffer and write to file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fsp.writeFile(tmpFile, buffer);

    return { filePath: tmpFile, originalFileName: file.name };
  } catch (error) {
    // Clean up on error
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

async function dwgToDxf(dwgPath: string): Promise<string> {
  console.log('Starting DWG to DXF conversion with CloudConvert...');
  
  // 1) Create CloudConvert job (import → convert → export)
  const job = await cloudconvert.jobs.create({
    tasks: {
      'import-my-file': { operation: 'import/upload' },
      'convert-dwg-dxf': {
        operation: 'convert',
        input: 'import-my-file',
        input_format: 'dwg',
        output_format: 'dxf'
      },
      'export-result': { operation: 'export/url', input: 'convert-dwg-dxf' }
    }
  });

  console.log(`CloudConvert job created: ${job.id}`);

  const uploadTask = job.tasks!.find(t => t.name === 'import-my-file')!;
  await cloudconvert.tasks.upload(uploadTask, fs.createReadStream(dwgPath));

  console.log('File uploaded to CloudConvert, waiting for conversion...');
  const finished = await cloudconvert.jobs.wait(job.id!);
  
  const exportTask = finished.tasks!.find(t => t.operation === 'export/url' && t.status === 'finished')!;
  const file = exportTask.result?.files?.[0];
  
  if (!file || !file.url) {
    throw new Error('No file or file URL found in export task result');
  }

  console.log('Conversion completed, downloading DXF file...');

  // 2) Download DXF locally
  const dxfPath = path.join(path.dirname(dwgPath), 'output.dxf');
  const res = await fetch(file.url);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dxfPath, buf);
  
  console.log(`DXF file saved to: ${dxfPath}`);
  return dxfPath;
}

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;
  
  try {
    console.log('Starting DWG conversion process...');
    
    const { filePath: dwgPath, originalFileName } = await readUpload(req);
    tmpDir = path.dirname(dwgPath);
    console.log(`DWG file uploaded to: ${dwgPath}`);
    
    const dxfPath = await dwgToDxf(dwgPath);
    
    // Upload both DWG and DXF files to Azure Blob Storage
    const dxfFileName = path.basename(dxfPath);
    // Create DXF filename based on original filename
    const originalDxfFileName = originalFileName.replace(/\.dwg$/i, '.dxf');
    let dxfUrl: string | null = null;
    let dwgUrl: string | null = null;
    let geoJsonUrl: string | null = null;
    
    console.log('Uploading files to Azure Blob Storage...');
    
    try {
      // Upload original DWG file to dwg container with original filename
      const dwgBuffer = await fsp.readFile(dwgPath);
      const dwgUploadResult = await uploadToAzureBlob(dwgBuffer, originalFileName, 'application/dwg', 'dwg');
      
      if (dwgUploadResult.success && dwgUploadResult.blobUrl) {
        dwgUrl = dwgUploadResult.blobUrl;
        console.log(`✅ DWG uploaded to: ${dwgUrl}`);
      } else {
        console.error('❌ Failed to upload DWG to Azure Blob Storage:', dwgUploadResult.error);
      }
      
      // Upload converted DXF file to dxf container with original-based filename
      const dxfBuffer = await fsp.readFile(dxfPath);
      const dxfUploadResult = await uploadToAzureBlob(dxfBuffer, originalDxfFileName, 'image/vnd.dxf', 'dxf');
      
      if (dxfUploadResult.success && dxfUploadResult.blobUrl) {
        dxfUrl = dxfUploadResult.blobUrl;
        console.log(`✅ DXF uploaded to: ${dxfUrl}`);
        
        // Convert DXF to GeoJSON and upload
        try {
          console.log('Converting DXF to GeoJSON...');
          const geoJsonData = convertDXFBufferToGeoJSON(dxfBuffer);
          const geoJsonBuffer = Buffer.from(JSON.stringify(geoJsonData, null, 2));
          
          // Create GeoJSON filename based on original filename
          const geoJsonFileName = originalFileName.replace(/\.dwg$/i, '.geojson');
          
          // Upload GeoJSON to cad-uploads container
          const geoJsonUploadResult = await uploadToAzureBlob(
            geoJsonBuffer,
            geoJsonFileName,
            'application/geo+json',
            'cad-uploads'
          );
          
          if (geoJsonUploadResult.success) {
            geoJsonUrl = geoJsonUploadResult.blobUrl || null;
            console.log(`✅ GeoJSON uploaded to: ${geoJsonUrl}`);
          } else {
            console.error('❌ Failed to upload GeoJSON:', geoJsonUploadResult.error);
          }
        } catch (conversionError) {
          console.error('❌ DXF to GeoJSON conversion failed:', conversionError);
          // Don't fail the upload if conversion fails, just log the error
        }
      } else {
        console.error('❌ Failed to upload DXF to Azure Blob Storage:', dxfUploadResult.error);
      }
    } catch (uploadError) {
      console.error('❌ Failed to upload files to Azure Blob Storage:', uploadError);
    }

    // Clean up temporary files
    try {
      if (tmpDir) {
        await fsp.rm(tmpDir, { recursive: true, force: true });
        console.log('Temporary files cleaned up');
      }
    } catch (cleanupErr) {
      console.warn('Failed to cleanup temporary files:', cleanupErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      url: dxfUrl,
      fileName: originalDxfFileName,
      originalFileName: originalDxfFileName,
      dwgUrl: dwgUrl,
      geoJsonUrl: geoJsonUrl,
      message: 'DWG successfully converted to DXF',
      uploadedToAzure: !!dxfUrl,
      dwgUploaded: !!dwgUrl,
      convertedToGeoJSON: !!geoJsonUrl
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Conversion failed:', e);
    
    // Clean up temporary files on error
    try {
      if (tmpDir) {
        await fsp.rm(tmpDir, { recursive: true, force: true });
        console.log('Temporary files cleaned up after error');
      }
    } catch (cleanupErr) {
      console.warn('Failed to cleanup temporary files after error:', cleanupErr);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message,
      details: 'Check server logs for more information'
    }), { 
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
