import { NextRequest, NextResponse } from 'next/server';
import { uploadToAzureBlob } from '../../../utils/azureBlobStorage';
import { convertDXFBufferToGeoJSON } from '../../../utils/dxfToGeoJSON';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Determine content type based on file extension
    const getContentType = (fileName: string): string => {
      const ext = fileName.toLowerCase().split('.').pop();
      switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'gif': return 'image/gif';
        case 'bmp': return 'image/bmp';
        case 'tiff': return 'image/tiff';
        case 'svg': return 'image/svg+xml';
        case 'dxf': return 'image/vnd.dxf';
        case 'geojson': return 'application/geo+json';
        case 'kml': return 'application/vnd.google-earth.kml+xml';
        case 'shp': return 'application/octet-stream';
        default: return 'application/octet-stream';
      }
    };

    // Determine container based on file type
    const getContainerName = (fileName: string): string => {
      const ext = fileName.toLowerCase().split('.').pop();
      switch (ext) {
        case 'dxf': return 'dxf';
        case 'dwg': return 'dwg';
        default: return 'cad-uploads';
      }
    };

    // Upload original file to Azure Blob Storage using utility
    const uploadResult = await uploadToAzureBlob(
      buffer, 
      file.name, 
      getContentType(file.name), 
      getContainerName(file.name)
    );
    
    if (!uploadResult.success) {
      return NextResponse.json({ 
        error: uploadResult.error || 'Upload failed' 
      }, { status: 500 });
    }

    // Check if it's a DXF file and convert to GeoJSON
    const isDxfFile = file.name.toLowerCase().endsWith('.dxf');
    let geoJsonUrl: string | null = null;

    if (isDxfFile) {
      try {
        console.log('Converting DXF to GeoJSON...');
        const geoJsonData = convertDXFBufferToGeoJSON(buffer);
        const geoJsonBuffer = Buffer.from(JSON.stringify(geoJsonData, null, 2));
        
        // Create GeoJSON filename
        const geoJsonFileName = file.name.replace(/\.dxf$/i, '.geojson');
        
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
    }
    
    return NextResponse.json({ 
      success: true, 
      url: uploadResult.blobUrl,
      fileName: file.name,
      geoJsonUrl: geoJsonUrl,
      convertedToGeoJSON: !!geoJsonUrl
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}