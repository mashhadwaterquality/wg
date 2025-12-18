
import React, { useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { WaterSample, MetricKey, METRIC_LABELS } from '../types';
import { Share2, Map as MapIcon, Layers, Camera, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

// Fix Leaflet Default Icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapViewProps {
  samples: WaterSample[];
}

const MapView: React.FC<MapViewProps> = ({ samples }) => {
  const [visualMode, setVisualMode] = useState<'standard' | 'heatmap'>('standard');
  const [isCapturing, setIsCapturing] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const defaultCenter: [number, number] = [35.6892, 51.3890];
  const center = samples.length > 0 
    ? [samples[0].location.lat, samples[0].location.lng] as [number, number]
    : defaultCenter;

  const getQualityColor = (s: WaterSample) => {
    if (s.metrics.turbidity > 5 || s.metrics.chlorine < 0.2) return '#ef4444'; 
    if (s.metrics.turbidity > 1 || s.metrics.chlorine < 0.5) return '#f59e0b'; 
    return '#10b981'; 
  };

  // Group paths by Sampler AND Day
  const dailyPaths = useMemo(() => {
    const paths: { color: string; positions: [number, number][]; label: string }[] = [];
    const samplerColors: Record<string, string> = {
      'محمدرضا ابتکاری': '#3b82f6',
      'ابوالفضل شرقی': '#8b5cf6',
      'سعید محرری': '#ec4899',
    };

    const grouped: Record<string, Record<string, WaterSample[]>> = {};
    
    samples.forEach(s => {
      const date = new Date(s.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (!grouped[s.samplerId]) grouped[s.samplerId] = {};
      if (!grouped[s.samplerId][date]) grouped[s.samplerId][date] = [];
      grouped[s.samplerId][date].push(s);
    });

    Object.entries(grouped).forEach(([sampler, dates]) => {
      Object.entries(dates).forEach(([date, daySamples]) => {
        const sorted = [...daySamples].sort((a, b) => a.timestamp - b.timestamp);
        if (sorted.length > 1) {
          paths.push({
            color: samplerColors[sampler] || '#cccccc',
            positions: sorted.map(s => [s.location.lat, s.location.lng] as [number, number]),
            label: `${sampler} - ${date}`
          });
        }
      });
    });
    return paths;
  }, [samples]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("لینک اشتراک‌گذاری کپی شد!");
  };

  const handleCapture = async () => {
    if (!mapContainerRef.current) return;
    
    setIsCapturing(true);
    try {
      // Small timeout to ensure any popups or interactions have settled
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const dataUrl = await toPng(mapContainerRef.current, {
        cacheBust: true,
        // We include a filter to skip leaflet controls if desired, 
        // but often users want the attribution and zoom controls for context.
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `aquaguard-map-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Map capture failed:', error);
      alert("خطا در تهیه تصویر از نقشه. اطمینان حاصل کنید که ارتباط اینترنتی برقرار است.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 h-[650px] flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapIcon className="text-blue-600 w-5 h-5"/> نقشه پایش و مسیرها
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setVisualMode('standard')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${visualMode === 'standard' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              استاندارد
            </button>
            <button
              onClick={() => setVisualMode('heatmap')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${visualMode === 'heatmap' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
            >
              تراکم شاخص
            </button>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleCapture} 
              disabled={isCapturing}
              className={`p-2 rounded-full transition flex items-center justify-center ${isCapturing ? 'text-blue-300' : 'text-gray-600 hover:bg-gray-100'}`} 
              title="کپچر نقشه (PNG)"
            >
                {isCapturing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Camera className="w-5 h-5"/>}
            </button>
            <button onClick={handleShare} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="اشتراک‌گذاری">
                <Share2 className="w-5 h-5"/>
            </button>
        </div>
      </div>

      <div 
        ref={mapContainerRef}
        className="flex-1 rounded-lg overflow-hidden relative z-0 border border-gray-100"
      >
        <MapContainer 
            center={center} 
            zoom={12} 
            scrollWheelZoom={true} 
            className="h-full w-full"
            ref={mapRef}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            // Important for cross-origin image capturing
            crossOrigin="anonymous"
          />

          {/* Chronological Paths */}
          {visualMode === 'standard' && dailyPaths.map((path, idx) => (
            <Polyline 
                key={idx} 
                positions={path.positions} 
                pathOptions={{ 
                  color: path.color, 
                  weight: 4, 
                  opacity: 0.6, 
                  dashArray: '8, 8'
                }} 
            >
              <Popup>{path.label}</Popup>
            </Polyline>
          ))}

          {samples.map((sample, idx) => (
             <CircleMarker 
                key={sample.id}
                center={[sample.location.lat, sample.location.lng]}
                pathOptions={
                  visualMode === 'heatmap' 
                  ? { radius: 15, fillColor: '#ef4444', color: 'transparent', fillOpacity: 0.4 }
                  : { color: getQualityColor(sample), fillColor: getQualityColor(sample), fillOpacity: 0.9, radius: 7 }
                }
             >
                <Popup className="text-right">
                    <div style={{ textAlign: 'right', direction: 'rtl' }} className="font-sans">
                        <strong className="block border-b mb-1 pb-1 text-blue-800">{sample.samplerId}</strong>
                        <div className="text-xs space-y-1">
                            <p className="font-bold">{new Date(sample.timestamp).toLocaleString('fa-IR')}</p>
                            <div className="grid grid-cols-2 gap-2 mt-2 bg-gray-50 p-2 rounded">
                                <span>کلر: {sample.metrics.chlorine}</span>
                                <span>pH: {sample.metrics.ph}</span>
                                <span>کدورت: {sample.metrics.turbidity}</span>
                                <span>EC: {sample.metrics.ec}</span>
                            </div>
                            <p className="text-gray-500 mt-2 text-[10px] italic">{sample.location.address}</p>
                        </div>
                    </div>
                </Popup>
             </CircleMarker>
          ))}
        </MapContainer>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg z-[1000] border border-gray-200 text-[10px] space-y-2">
          <div className="font-bold border-b pb-1 mb-1">راهنمای نقشه</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10b981]"></div> <span>مطلوب</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div> <span>هشدار</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div> <span>نامطلوب</span>
          </div>
          <div className="pt-1 border-t">خط‌چین: مسیر تردد روزانه</div>
        </div>
      </div>
      {isCapturing && (
        <div className="text-[10px] text-blue-600 mt-2 font-bold animate-pulse text-center">
          در حال پردازش و آماده‌سازی فایل تصویر...
        </div>
      )}
    </div>
  );
};

export default MapView;
