import React, { useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { WaterSample, MetricKey, METRIC_LABELS } from '../types';
import { Share2, Camera } from 'lucide-react';

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
  const [heatmapMetric, setHeatmapMetric] = useState<MetricKey>('turbidity');
  const mapRef = useRef<L.Map | null>(null);

  const defaultCenter: [number, number] = [35.6892, 51.3890];
  const center = samples.length > 0 
    ? [samples[samples.length-1].location.lat, samples[samples.length-1].location.lng] as [number, number]
    : defaultCenter;

  const getQualityColor = (s: WaterSample) => {
    if (s.metrics.turbidity > 5 || s.metrics.chlorine < 0.2) return '#ef4444'; 
    if (s.metrics.turbidity > 1 || s.metrics.chlorine < 0.5) return '#f59e0b'; 
    return '#10b981'; 
  };

  const getWeightedStyle = (s: WaterSample) => {
    const val = s.metrics[heatmapMetric];
    let radius = 8;
    if (heatmapMetric === 'turbidity') radius = 5 + (val * 2);
    if (heatmapMetric === 'ec') radius = 5 + (val / 100);
    if (heatmapMetric === 'ph') radius = 5 + Math.abs(7 - val) * 3;
    if (heatmapMetric === 'chlorine') radius = 5 + (val * 5);
    return { radius: Math.min(radius, 30), fillColor: val > 0 ? '#ef4444' : '#3b82f6', color: 'transparent', fillOpacity: 0.6 };
  };

  const routes = React.useMemo(() => {
    const grouped: Record<string, [number, number][]> = {};
    samples.forEach(s => {
      if (!grouped[s.samplerId]) grouped[s.samplerId] = [];
      grouped[s.samplerId].push([s.location.lat, s.location.lng]);
    });
    return grouped;
  }, [samples]);

  const samplerColors: Record<string, string> = {
    'Sampler 1': '#3b82f6',
    'Sampler 2': '#8b5cf6',
    'Sampler 3': '#ec4899',
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("لینک اشتراک‌گذاری کپی شد!");
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 h-[600px] flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">نقشه تعاملی</h2>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setVisualMode('standard')}
              className={`px-3 py-1 text-sm rounded-md transition ${visualMode === 'standard' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              استاندارد
            </button>
            <button
              onClick={() => setVisualMode('heatmap')}
              className={`px-3 py-1 text-sm rounded-md transition ${visualMode === 'heatmap' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
            >
              تراکم
            </button>
          </div>
          {visualMode === 'heatmap' && (
             <select 
               value={heatmapMetric} 
               onChange={(e) => setHeatmapMetric(e.target.value as MetricKey)}
               className="text-sm border rounded p-1"
             >
               {(Object.keys(METRIC_LABELS) as MetricKey[]).map(k => (
                 <option key={k} value={k}>{METRIC_LABELS[k]}</option>
               ))}
             </select>
          )}
        </div>
        <div className="flex gap-2">
            <button onClick={handleShare} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="اشتراک‌گذاری">
                <Share2 className="w-5 h-5"/>
            </button>
             <button onClick={() => alert("امکان ذخیره تصویر در این نسخه فعال نیست.")} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full" title="ذخیره نقشه">
                <Camera className="w-5 h-5"/>
            </button>
        </div>
      </div>

      <div className="flex-1 rounded-lg overflow-hidden relative z-0">
        <MapContainer 
            center={center} 
            zoom={13} 
            scrollWheelZoom={true} 
            className="h-full w-full"
            ref={mapRef}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visualMode === 'standard' && Object.entries(routes).map(([sampler, positions]) => (
            <Polyline 
                key={sampler} 
                positions={positions} 
                pathOptions={{ color: samplerColors[sampler], weight: 3, opacity: 0.7, dashArray: '10, 10' }} 
            />
          ))}

          {samples.map(sample => (
             <CircleMarker 
                key={sample.id}
                center={[sample.location.lat, sample.location.lng]}
                pathOptions={
                    visualMode === 'heatmap' 
                    ? getWeightedStyle(sample)
                    : { color: getQualityColor(sample), fillColor: getQualityColor(sample), fillOpacity: 0.8, radius: 6 }
                }
             >
                <Popup className="text-right">
                    <div style={{ textAlign: 'right', direction: 'rtl' }}>
                        <strong className="block border-b mb-1 pb-1">{sample.samplerId}</strong>
                        <div className="text-xs space-y-1">
                            <p>{new Date(sample.timestamp).toLocaleString('fa-IR')}</p>
                            <p>کلر: {sample.metrics.chlorine}</p>
                            <p>pH: {sample.metrics.ph}</p>
                            <p className="text-gray-500 mt-1">{sample.location.address}</p>
                        </div>
                    </div>
                </Popup>
             </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;