'use client';

import { useEffect, useRef, useState } from 'react';
import { convertToMultiGeometry } from './singletomulti';
import GroupTransformControl from './GroupTransformControl';

interface ComprehensiveSampleViewerProps {
  map: any;
  L?: any;
  vectorData?: any;
  onGeoJsonDataChange?: (data: any) => void;
}

export default function ComprehensiveSampleViewer({ map, L, vectorData, onGeoJsonDataChange }: ComprehensiveSampleViewerProps) {
  const layersRef = useRef<any[]>([]);
  const [layers, setLayers] = useState<any[]>([]);
  const [dragging, setDragging] = useState(true);
  const [scaling, setScaling] = useState(true);
  const [rotation, setRotation] = useState(true);
  const [uniformScaling, setUniformScaling] = useState(true);

  useEffect(() => {
    if (!map || !L) return;

    // Clear existing layers
    layersRef.current.forEach(layer => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    layersRef.current = [];

    // Load vector data if available, otherwise use sample data
    const loadVectorData = async () => {
      let geoJsonData: any = null;
      
      if (vectorData) {
        try {
          // Load GeoJSON data from vectorData
          if (vectorData.geoJsonUrl) {
            const response = await fetch(vectorData.geoJsonUrl);
            if (!response.ok) {
              throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
            }
            geoJsonData = await response.json();
          } else if (vectorData.geoJsonData) {
            geoJsonData = vectorData.geoJsonData;
          } else if (vectorData.url && vectorData.fileName?.match(/\.geojson$/i)) {
            const response = await fetch(vectorData.url);
            if (!response.ok) {
              throw new Error(`Failed to load GeoJSON file: ${response.statusText}`);
            }
            geoJsonData = await response.json();
          } else if (vectorData.url && vectorData.fileName?.match(/\.dxf$/i)) {
            const response = await fetch(vectorData.url);
            if (!response.ok) {
              throw new Error(`Failed to load DXF file: ${response.statusText}`);
            }
            const dxfContent = await response.text();
            const { parseDXFToGeoJSON } = await import('@/utils/dxfToGeoJSON');
            geoJsonData = parseDXFToGeoJSON(dxfContent);
          }
        } catch (error) {
          console.error('Error loading vector data:', error);
        }
      }

      // If no vector data or loading failed, use sample data
      if (!geoJsonData?.features?.length) {
        // Sample polygon data (fallback)
        const polyGonLatLong = L.GeoJSON.coordsToLatLngs([
          [113.97697448730469, 22.403410892712124],
          [113.98658752441405, 22.38373008592495],
          [114.01268005371094, 22.369126397545887],
          [114.02778625488281, 22.38563480185718],
          [114.04701232910156, 22.395157990290755],
          [114.06005859375, 22.413567638369805],
          [114.06280517578125, 22.432609534876796],
          [114.04838562011717, 22.444668051657157],
          [114.04289245605469, 22.44847578656544],
          [114.03259277343749, 22.444668051657157],
          [114.01954650878906, 22.447206553211814],
          [113.99620056152344, 22.436417600763114],
          [113.98178100585938, 22.420549970290875],
          [113.97697448730469, 22.403410892712124],
        ]);

        const polylineLatLong = L.GeoJSON.coordsToLatLngs([
          [114.14314270019531, 22.49479484975443],
          [114.1534423828125, 22.485912942320958],
          [114.15206909179688, 22.4732235144781],
          [114.14932250976561, 22.459898363943893],
          [114.15962219238281, 22.447206553211814],
          [114.169921875, 22.447206553211814],
          [114.19395446777344, 22.459898363943893],
          [114.20631408691406, 22.46116748110935],
          [114.21180725097655, 22.473858013487614],
          [114.22416687011719, 22.471320000009992],
          [114.23721313476562, 22.476395980457973],
          [114.24201965332031, 22.49352604073722],
          [114.2303466796875, 22.51572851830351],
          [114.21798706054688, 22.524608511026262],
          [114.20768737792969, 22.524608511026262],
          [114.20768737792969, 22.536024805886974],
        ]);

        const rectangleLatLongBounds = L.latLngBounds([
          [22.334833457530486, 114.0154266357422],
          [22.244615500323064, 114.14108276367189],
        ]);

        // MultiPolygon data (fallback)
        const multiPolygonLatLong = [
          L.GeoJSON.coordsToLatLngs([
            [114.20562744140625, 22.32085984100593],
            [114.21592712402344, 22.35261603551215],
            [114.26467895507812, 22.351345926606957],
            [114.2749786376953, 22.32403578584038],
            [114.29214477539062, 22.32721165838893],
            [114.3017578125, 22.311966810977616],
            [114.29420471191406, 22.291002427735325],
            [114.29351806640625, 22.272576585413475],
            [114.28390502929688, 22.26177410097435],
            [114.268798828125, 22.281472122783818],
            [114.2749786376953, 22.294814367780518],
            [114.26948547363281, 22.30243793590448],
            [114.27017211914062, 22.31514295816939],
            [114.2578125, 22.311966810977616],
            [114.24751281738281, 22.299896792751927],
            [114.24545288085938, 22.291002427735325],
            [114.22966003417969, 22.307520083522476],
            [114.22073364257812, 22.305614299837046],
            [114.20562744140625, 22.32085984100593],
          ]),
          L.GeoJSON.coordsToLatLngs([
            [114.31549072265625, 22.33927931468312],
            [114.32029724121094, 22.326576489662482],
            [114.32991027832031, 22.326576489662482],
            [114.33334350585938, 22.332292904091716],
            [114.32304382324219, 22.3424548401465],
            [114.31549072265625, 22.33927931468312],
          ]),
          L.GeoJSON.coordsToLatLngs([
            [114.27909851074219, 22.244615500323064],
            [114.28115844726562, 22.251606295132948],
            [114.28665161132812, 22.255419308858556],
            [114.29969787597656, 22.26113863474449],
            [114.2962646484375, 22.250970782750866],
            [114.29489135742188, 22.24080219246335],
            [114.29008483886717, 22.238895499613232],
            [114.27909851074219, 22.244615500323064],
          ]),
        ];

        // Create layers with sample data
        const polygon = new L.Polygon(polyGonLatLong, {
          color: '#f00',
          interactive: true,
          draggable: true,
          transform: true,
        }).addTo(map);

        const polyline = new L.Polyline(polylineLatLong, {
          weight: 15,
          draggable: true,
          transform: true,
        }).bindPopup('L.Polyline').addTo(map);

        const rectangle = new L.Rectangle(rectangleLatLongBounds, {
          weight: 2,
          draggable: true,
          transform: true,
        }).bindPopup('L.Rectangle').addTo(map);

        const multiPolygon = new L.Polygon(multiPolygonLatLong, {
          draggable: true,
          transform: true,
          color: '#092',
        }).bindPopup('MultiPolygon').addTo(map);

        layersRef.current = [polygon, polyline, rectangle, multiPolygon];

        // Create sample GeoJSON data for export
        const sampleGeoJsonData = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [113.97697448730469, 22.403410892712124],
                  [113.98658752441405, 22.38373008592495],
                  [114.01268005371094, 22.369126397545887],
                  [114.02778625488281, 22.38563480185718],
                  [114.04701232910156, 22.395157990290755],
                  [114.06005859375, 22.413567638369805],
                  [114.06280517578125, 22.432609534876796],
                  [114.04838562011717, 22.444668051657157],
                  [114.04289245605469, 22.44847578656544],
                  [114.03259277343749, 22.444668051657157],
                  [114.01954650878906, 22.447206553211814],
                  [113.99620056152344, 22.436417600763114],
                  [113.98178100585938, 22.420549970290875],
                  [113.97697448730469, 22.403410892712124]
                ]]
              },
              properties: { name: "Sample Polygon" }
            }
          ]
        };

        // Notify parent component of the sample GeoJSON data
        if (onGeoJsonDataChange) {
          onGeoJsonDataChange(sampleGeoJsonData);
        }
      } else {
        // Use uploaded vector data
        try {
          // Validate GeoJSON data before processing
          if (!geoJsonData || !geoJsonData.features || !Array.isArray(geoJsonData.features)) {
            throw new Error('Invalid GeoJSON data structure');
          }

          // Convert to MultiPolygon using singletomulti
          const convertedGeoJsonData = convertToMultiGeometry(geoJsonData);

          // Validate converted data
          if (!convertedGeoJsonData || !convertedGeoJsonData.features || !Array.isArray(convertedGeoJsonData.features)) {
            throw new Error('Failed to convert GeoJSON data');
          }

          // Notify parent component of the converted GeoJSON data
          if (onGeoJsonDataChange) {
            onGeoJsonDataChange(convertedGeoJsonData);
          }

          // Safe GeoJSON loader that prevents LatLng conversion errors
          const toLL = (c: any, L: any) => {
            // Validate that c is a valid coordinate pair
            if (!Array.isArray(c) || c.length !== 2) {
              console.warn('Invalid coordinate structure:', c);
              return null;
            }
            
            const [lng, lat] = c;
            
            // Check for valid numbers (not NaN, not Infinity)
            if (typeof lng !== 'number' || typeof lat !== 'number' || 
                isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
              console.warn('Invalid coordinate values:', { lng, lat, original: c });
              return null;
            }
            
            // Check for reasonable coordinate bounds
            if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
              console.warn('Coordinate out of bounds:', { lng, lat });
              return null;
            }
            
            return L.latLng(lat, lng); // [lng,lat] → LatLng
          };

          const closeRing = (ring: any[]) => {
            if (!ring?.length) return ring;
            const a = ring[0], b = ring[ring.length - 1];
            return (a.lat === b.lat && a.lng === b.lng) ? ring : [...ring, a];
          };

          // Determine depth based on actual coordinate structure, not geometry type
          const getActualDepth = (coordinates: any): number => {
            if (!Array.isArray(coordinates)) return -1;
            
            // Check if it's a single coordinate pair [lng, lat]
            if (coordinates.length === 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
              return 0; // Point
            }
            
            // Check if it's an array of coordinate pairs [[lng,lat], [lng,lat], ...]
            if (Array.isArray(coordinates[0]) && coordinates[0].length === 2 && 
                typeof coordinates[0][0] === 'number' && typeof coordinates[0][1] === 'number') {
              return 0; // LineString or Polygon ring
            }
            
            // Check if it's an array of arrays of coordinate pairs [[[lng,lat], [lng,lat]], ...]
            if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && 
                coordinates[0][0].length === 2 && typeof coordinates[0][0][0] === 'number') {
              return 1; // MultiLineString or Polygon with holes
            }
            
            // Check if it's an array of arrays of arrays [[[[lng,lat], [lng,lat]], ...], ...]
            if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && 
                Array.isArray(coordinates[0][0][0]) && coordinates[0][0][0].length === 2) {
              return 2; // MultiPolygon
            }
            
            return -1; // Unknown structure
          };

          const isLatLng = (v: any) => v && typeof v.lat === 'number' && typeof v.lng === 'number';

          function ensureClosed(latlngs: any, type: string) {
            if (type === 'Polygon') return latlngs.map(closeRing);
            if (type === 'MultiPolygon') return latlngs.map((poly: any[]) => poly.map(closeRing));
            return latlngs;
          }

          const layers: any[] = [];
          const renderer = L.svg(); // ensure SVG renderer for handles
          
          convertedGeoJsonData.features.forEach((feature: any, index: number) => {
            const geometry = feature.geometry;
            if (!geometry || !geometry.coordinates) return;
            
            // Use actual coordinate structure depth instead of geometry type
            const depth = getActualDepth(geometry.coordinates);
            if (depth === -1) {
              console.warn(`Feature ${index}: Unknown coordinate structure`, geometry.coordinates);
              return;
            }

            try {
              // Convert coordinates with proper structure for MultiPolygon (like hardcoded example)
              let latlngs;
              if (geometry.type === 'MultiPolygon') {
                // For MultiPolygon, create array of exterior rings only (like hardcoded multiPolygonLatLong)
                latlngs = geometry.coordinates.map((poly: any) => 
                  L.GeoJSON.coordsToLatLngs(poly[0], 0, (c: number[]) => toLL(c, L))
                );
                console.log(`ComprehensiveSampleViewer - MultiPolygon converted to exterior rings:`, {
                  originalPolygons: geometry.coordinates.length,
                  exteriorRings: latlngs.length
                });
              } else if (geometry.type === 'Polygon') {
                // For single Polygon, take only the exterior ring
                latlngs = [L.GeoJSON.coordsToLatLngs(geometry.coordinates[0], 0, (c: number[]) => toLL(c, L))];
                console.log(`ComprehensiveSampleViewer - Polygon converted to exterior ring`);
              } else {
                // For other types, use the original conversion
                latlngs = L.GeoJSON.coordsToLatLngs(geometry.coordinates, depth, (c: number[]) => toLL(c, L));
              }
              
              // Filter out null values that might have been created by invalid coordinates
              const filterNulls = (arr: any): any => {
                if (Array.isArray(arr)) {
                  return arr.map(filterNulls).filter(item => item !== null);
                }
                return arr;
              };
              latlngs = filterNulls(latlngs);
              
              // Only apply ring closure for polygon-like structures
              if (depth >= 1 && (geometry.type.includes('Polygon') || geometry.type.includes('Line'))) {
                latlngs = ensureClosed(latlngs, geometry.type);
              }

              // Quick structural sanity: everything must ultimately be LatLngs
              const walk = (a: any): boolean => isLatLng(a) || (Array.isArray(a) && a.every(walk));
              if (!walk(latlngs)) throw new Error('LatLng structure malformed (depth/flattening issue)');

              // Additional validation: ensure we have valid coordinates for layer creation
              const hasValidCoordinates = (arr: any): boolean => {
                if (Array.isArray(arr)) {
                  return arr.length > 0 && arr.every(hasValidCoordinates);
                }
                return isLatLng(arr);
              };
              
              if (!hasValidCoordinates(latlngs)) {
                throw new Error('No valid coordinates found for layer creation');
              }

              // Split MultiPolygons and MultiLineStrings into individual layers
              // Transform plugin expects individual polygons (2-level) not MultiPolygons (3-level)
              const createIndividualLayers = (latlngs: any, geometryType: string) => {
                const isLineStructure = depth === 0 && geometryType.includes('Line');
                
                if (depth === 2) {
                  // MultiPolygon or MultiLineString - split into individual parts
                  // Use different colors based on z-index for visual distinction
                  const zIndex = feature.properties?.z || 0;
                  const colors = ['#092', '#0066cc', '#cc6600', '#6600cc', '#00cc66', '#cc0066'];
                  const color = colors[zIndex % colors.length];
                  
                  latlngs.forEach((part: any, partIndex: number) => {
                    const layer = isLineStructure
                      ? L.polyline(part, { 
                          renderer, 
                          color: color, 
                          weight: 3, 
                          opacity: 0.9
                        }).addTo(map)
                      : L.polygon(part, { 
                          renderer, 
                          color: color, 
                          weight: 3, 
                          opacity: 0.9, 
                          fillOpacity: 0.3
                        }).addTo(map);
                    
                    layers.push(layer);
                  });
                } else {
                  // Single Polygon or LineString - create one layer
                  // Use different colors based on z-index for visual distinction
                  const zIndex = feature.properties?.z || 0;
                  const colors = ['#092', '#0066cc', '#cc6600', '#6600cc', '#00cc66', '#cc0066'];
                  const color = colors[zIndex % colors.length];
                  
                  const layer = isLineStructure
                    ? L.polyline(latlngs, { 
                        renderer, 
                        color: color, 
                        weight: 3, 
                        opacity: 0.9
                      }).addTo(map)
                    : L.polygon(latlngs, { 
                        renderer, 
                        color: color, 
                        weight: 3, 
                        opacity: 0.9, 
                        fillOpacity: 0.3
                      }).addTo(map);
                  
                  layers.push(layer);
                }
              };

              createIndividualLayers(latlngs, geometry.type);
            } catch (e) {
              console.error(`Feature ${index} failed:`, e, 'Coordinates:', geometry.coordinates, 'Depth:', depth);
            }
          });

          layersRef.current = layers;
          setLayers(layers);

          // Fit map to show all features
          try {
            if (layers.length > 0) {
              const group = new L.FeatureGroup(layers);
              const bounds = group.getBounds();
              if (bounds && bounds.isValid && bounds.isValid()) {
                map.fitBounds(bounds.pad(0.1));
              }
            }
          } catch (boundsError) {
            console.warn('Could not fit bounds for vector data:', boundsError);
          }
        } catch (error) {
          console.error('Error creating vector layers:', error);
        }
      }
    };

    loadVectorData();

    // Add event listeners to properly handle transform cleanup
    const layers = layersRef.current;
    
    // Use a more robust approach - monitor the map for transform events
    const handleTransformCleanup = () => {
      layers.forEach(layer => {
        if (layer.transform && layer.transform._bounds) {
          try {
            // Check if bounds are orphaned and clean them up
            if (!map.hasLayer(layer.transform._bounds)) {
              layer.transform._bounds.remove();
            }
          } catch (error) {
            console.warn('Error cleaning up transform bounds:', error);
          }
        }
      });
    };

    layers.forEach(layer => {
      // Listen for drag events to clean up duplicates without disabling transform
      layer.on('dragend', () => {
        // Clean up any duplicate layers that might have been created
        setTimeout(() => {
          try {
            const allLayers = map._layers;
            Object.values(allLayers).forEach((mapLayer: any) => {
              if (mapLayer instanceof L.Polygon && 
                  mapLayer !== layer && 
                  mapLayer.getLatLngs && 
                  mapLayer.getPopup && 
                  mapLayer.getPopup()?.getContent() === layer.getPopup()?.getContent()) {
                // This is a duplicate layer, remove it
                console.log('Removing duplicate layer after drag');
                map.removeLayer(mapLayer);
              }
            });
          } catch (error) {
            console.warn('Error cleaning up duplicates after drag:', error);
          }
        }, 50);
      });
    });

    // Add cleanup handler to map events
    map.on('zoomend moveend', handleTransformCleanup);

    // Store all layers
    layersRef.current = layers;

    // Don't enable transforms automatically - this matches the official behavior
    // Transforms will be enabled when user interacts with the controls

    // Make available globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).sampleLayers = layers;
    }

    // Make reset function available globally (simplified for dynamic data)
    if (typeof window !== 'undefined') {
      (window as any).resetShapes = () => {
        layers.forEach(function (layer) {
          if (layer.transform) {
            try {
              // Disable transform first to clean up handles
              layer.transform.disable();
              // Reset the transform
              layer.transform.reset();
              // Re-enable if controls are active
              if (scaling || rotation) {
                layer.transform.enable();
              }
            } catch (error) {
              console.warn('Reset error on layer:', error);
            }
          }
        });
      };
    }

    // Cleanup function
    return () => {
      layersRef.current.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
          // Clean up transform handles before removing layer
          if (layer.transform) {
            try {
              layer.transform.disable();
              // Remove any orphaned transform bounds
              if (layer.transform._bounds && map.hasLayer(layer.transform._bounds)) {
                map.removeLayer(layer.transform._bounds);
              }
            } catch (error) {
              console.warn('Transform cleanup error:', error);
            }
          }
          map.removeLayer(layer);
        }
      });
      layersRef.current = [];
      
      // Remove map event listeners
      map.off('zoomend moveend', handleTransformCleanup);
    };
  }, [map, L]);


  const handleReset = () => {
    if (typeof window !== 'undefined' && (window as any).resetShapes) {
      (window as any).resetShapes();
    }
  };

  return (
    <>
      <GroupTransformControl 
        map={map} 
        L={L} 
        layers={layers} 
      />
    </>
  );
}
