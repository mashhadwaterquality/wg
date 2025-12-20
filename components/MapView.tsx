
import React, { useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { WaterSample, SAMPLERS, MetricKey, METRIC_LABELS, METRIC_RANGES } from '../types';
import { Share2, Map as MapIcon, Camera, Loader2, Filter, Users, Activity } from 'lucide-react';
import { toPng } from 'html-to-image';
import InterpolationLayer from './InterpolationLayer';

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

const samplerColors: Record<string, string> = {
  'محمدرضا ابتکاری': '#3b82f6',
  'ابوالفضل شرقی': '#8b5cf6',
  'سعید محرری': '#ec4899',
};

// 5-Level Spectrum for Quality Ranking
// Excellent = Cyan (Blue), Danger = Red
const QUALITY_SPECTRUM = [
  '#06b6d4', // Level 1: Cyan (Excellent - Best Quality)
  '#10b981', // Level 2: Emerald (Good)
  '#facc15', // Level 3: Yellow (Caution)
  '#f97316', // Level 4: Orange (Warning)
  '#ef4444'  // Level 5: Red (Danger - Worst Quality)
];

const MapView: React.FC<MapViewProps> = ({ samples }) => {
  const [visualMode, setVisualMode] = useState<'standard' | 'heatmap' | 'interpolation'>('standard');
  const [selectedSampler, setSelectedSampler] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('chlorine');
  const [isCapturing, setIsCapturing] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const filteredSamples = useMemo(() => {
    if (selectedSampler === 'all') return samples;
    return samples.filter(s => s.samplerId === selectedSampler);
  }, [samples, selectedSampler]);

  const defaultCenter: [number, number] = [35.6892, 51.3890];
  const center = filteredSamples.length > 0 
    ? [filteredSamples[0].location.lat, filteredSamples[0].location.lng] as [number, number]
    : defaultCenter;

  /**
   * Calculates the quality color using the 5-step spectrum
   * Excellent (0 for EC/Turbidity, Center for pH/Cl) -> Cyan
   * Danger (Max for EC/Turbidity, Bounds for pH/Cl) -> Red
   */
  const getQualityColor = (s: WaterSample) => {
    const range = METRIC_RANGES[selectedMetric];
    const val = s.metrics[selectedMetric] as number;
    if (val === null || val === undefined) return '#cbd5e1';

    let ratio = 0;
    if (selectedMetric === 'ph' || selectedMetric === 'chlorine') {
      const mid = (range.min + range.max) / 2;
      const rangeHalf = (range.max - range.min) / 2;
      ratio = Math.abs(val - mid) / rangeHalf;
    } else {
      // EC/Turbidity: 0 is Good (Ratio 0 -> Index 0), range.max is threshold
      ratio = val / range.max;
    }

    // Clamp ratio to [0, 1] and map to 5 levels
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const index = Math.min(Math.floor(clampedRatio * 5), 4);
    return QUALITY_SPECTRUM[index];
  };

  const dailyPaths = useMemo(() => {
    const paths: { color: string; positions: [number, number][]; label: string }[] = [];
    const grouped: Record<string, Record<string, WaterSample[]>> = {};
    
    filteredSamples.forEach(s => {
      const date = new Date(s.timestamp).toLocaleDateString('en-CA'); 
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
  }, [filteredSamples]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("لینک اشتراک‌گذاری کپی شد!");
  };

  const handleCapture = async () => {
    if (!mapContainerRef.current) return;
    setIsCapturing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const dataUrl = await toPng(mapContainerRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `aquaguard-map-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Map capture failed:', error);
      alert("خطا در تهیه تصویر از نقشه.");
    } finally {
      setIsCapturing(false);
    }
  };

  const currentRange = METRIC_RANGES[selectedMetric];

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 h-[750px] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MapIcon className="text-blue-600 w-5 h-5"/> نقشه پایش و تراکم
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto max-w-full shadow-inner">
            <button
              onClick={() => setVisualMode('standard')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-md transition whitespace-nowrap ${visualMode === 'standard' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              استاندارد
            </button>
            <button
              onClick={() => setVisualMode('heatmap')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-md transition whitespace-nowrap ${visualMode === 'heatmap' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
            >
              تراکم
            </button>
            <button
              onClick={() => setVisualMode('interpolation')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-md transition whitespace-nowrap ${visualMode === 'interpolation' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
            >
              درون‌یابی پارامتری
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
             <Activity className="w-4 h-4 text-indigo-400" />
             <select 
               value={selectedMetric} 
               onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
               className="bg-transparent text-xs font-bold outline-none text-indigo-700"
             >
               {Object.entries(METRIC_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
             </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
            <Users className="w-4 h-4 text-gray-400" />
            <select 
              value={selectedSampler} 
              onChange={(e) => setSelectedSampler(e.target.value)}
              className="bg-transparent text-xs font-bold outline-none"
            >
              <option value="all">تمام نمونه‌بردارها</option>
              {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-1 bg-gray-50 rounded-full p-1 border border-gray-100">
            <button onClick={handleCapture} disabled={isCapturing} className="p-2.5 rounded-full transition flex items-center justify-center text-gray-600 hover:bg-white hover:shadow-sm">
                {isCapturing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Camera className="w-5 h-5"/>}
            </button>
            <button onClick={handleShare} className="p-2.5 text-gray-600 hover:bg-white hover:shadow-sm rounded-full transition">
                <Share2 className="w-5 h-5"/>
            </button>
          </div>
        </div>
      </div>

      <div ref={mapContainerRef} className="flex-1 rounded-2xl overflow-hidden relative z-0 border border-gray-100 shadow-inner">
        <MapContainer center={center} zoom={12} scrollWheelZoom={true} className="h-full w-full" ref={mapRef}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
          />

          {visualMode === 'interpolation' && (
            <InterpolationLayer samples={filteredSamples} metric={selectedMetric} opacity={0.4} />
          )}

          {visualMode === 'standard' && dailyPaths.map((path, idx) => (
            <Polyline key={idx} positions={path.positions} pathOptions={{ color: path.color, weight: 3, opacity: 0.4, dashArray: '8, 8' }} />
          ))}

          {filteredSamples.map((sample) => (
             <CircleMarker 
                key={sample.id}
                center={[sample.location.lat, sample.location.lng]}
                radius={visualMode === 'heatmap' ? 25 : 8}
                pathOptions={
                  visualMode === 'heatmap' 
                  ? { fillColor: samplerColors[sample.samplerId] || '#ef4444', color: 'transparent', fillOpacity: 0.4 }
                  : { 
                      color: getQualityColor(sample), // Border shows spectrum (Excellent=Blue, Danger=Red)
                      fillColor: samplerColors[sample.samplerId], // Fill shows sampler identity
                      fillOpacity: 1, 
                      weight: 1, 
                      stroke: true 
                    }
                }
             >
                <Popup className="text-right">
                    <div style={{ textAlign: 'right', direction: 'rtl' }} className="font-sans p-1">
                        <strong className="block border-b mb-2 pb-1 text-blue-900 text-sm">{sample.samplerId}</strong>
                        <div className="text-[11px] space-y-1.5">
                            <p className="font-bold text-gray-500">{new Date(sample.timestamp).toLocaleString('fa-IR')}</p>
                            <div className="grid grid-cols-2 gap-2 mt-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                <div className="flex flex-col"><span className="text-[9px] text-blue-400">کلر</span><span className="font-black text-blue-700">{sample.metrics.chlorine}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] text-blue-400">pH</span><span className="font-black text-blue-700">{sample.metrics.ph}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] text-blue-400">EC</span><span className="font-black text-blue-700">{sample.metrics.ec}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] text-blue-400">کدورت</span><span className="font-black text-blue-700">{sample.metrics.turbidity || '-'}</span></div>
                            </div>
                        </div>
                    </div>
                </Popup>
             </CircleMarker>
          ))}
        </MapContainer>
        
        {/* LEGEND COMPONENT */}
        <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[1000] border border-gray-200 text-[10px] space-y-3 min-w-[200px]">
          <div className="font-black border-b border-gray-100 pb-2 mb-2 text-gray-800 flex items-center gap-2">
            <Filter className="w-3 h-3 text-blue-500" /> رتبه‌بندی کیفی پارامتر
          </div>
          
          <div className="space-y-4">
            <div className="text-[9px] font-black text-indigo-600 uppercase">
              {METRIC_LABELS[selectedMetric]} <span className="text-gray-400">({currentRange.unit || 'مقیاس'})</span>
            </div>
            
            {/* Legend for the Quality Spectrum: Excellent (Cyan) to Danger (Red) */}
            <div className="relative pt-1">
              <div className="h-3 w-full rounded-full flex overflow-hidden">
                {/* Visualizing spectrum: Cyan (Right/0) to Red (Left/Max) for RTL context */}
                {QUALITY_SPECTRUM.map((c, i) => (
                  <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }}></div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-gray-500 text-[8px] mt-1.5">
                <span>عالی (آبی)</span>
                <span>متوسط (زرد)</span>
                <span>بحرانی (قرمز)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm border border-cyan-400"></div>
                  <span className="text-gray-600 font-bold">حاشیه: رتبه کیفی (آبی=عالی)</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                  <span className="text-gray-600 font-bold">مرکز: هویت فرد</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
