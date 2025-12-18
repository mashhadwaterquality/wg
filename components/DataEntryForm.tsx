import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapPin, Save, RotateCcw, Loader2, AlertCircle, User, Layers, BarChart } from 'lucide-react';
import { SamplerID, WaterSample, WaterMetrics, GeoLocation, SAMPLERS } from '../types';
import { getAddressFromCoords, calculateDistance } from '../utils/geo';

interface DataEntryFormProps {
  onSave: (sample: WaterSample) => void;
  samples: WaterSample[];
}

const emptyMetrics = {
  chlorine: '',
  ec: '',
  ph: '',
  turbidity: ''
};

const DataEntryForm: React.FC<DataEntryFormProps> = ({ onSave, samples }) => {
  const [samplerId, setSamplerId] = useState<SamplerID>(SAMPLERS[0]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  const debounceRef = useRef<number | null>(null);

  // Calculate statistics for the summary at the bottom
  const samplerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    SAMPLERS.forEach(s => stats[s] = 0);
    samples.forEach(s => {
      if (stats[s.samplerId] !== undefined) {
        stats[s.samplerId]++;
      }
    });
    return stats;
  }, [samples]);

  const samplerColors: Record<string, string> = {
    'محمدرضا ابتکاری': 'bg-blue-50 text-blue-700 border-blue-200',
    'ابوالفضل شرقی': 'bg-purple-50 text-purple-700 border-purple-200',
    'سعید محرری': 'bg-pink-50 text-pink-700 border-pink-200',
  };

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    const addr = await getAddressFromCoords(lat, lng);
    setLocation(prev => prev ? { ...prev, address: addr } : null);
  }, []);

  const updateLocation = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = pos.coords;
    
    setLocation(prev => {
      const shouldFetchAddress = !prev || !prev.address || 
        calculateDistance(prev.lat, prev.lng, latitude, longitude) > 50;

      if (shouldFetchAddress) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        
        debounceRef.current = window.setTimeout(() => {
          fetchAddress(latitude, longitude);
        }, 1500);
      }

      return {
        lat: latitude,
        lng: longitude,
        accuracy,
        timestamp: pos.timestamp,
        address: prev?.address || 'در حال دریافت آدرس...'
      };
    });
    setIsLocating(false);
  }, [fetchAddress]);

  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
      setIsLocating(true);
      watchId = navigator.geolocation.watchPosition(
        updateLocation,
        (err) => {
          setIsLocating(false);
          setGeoError(err.message);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    } else {
      setGeoError("مرورگر شما از موقعیت مکانی پشتیبانی نمی‌کند.");
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [updateLocation]);

  const handleInputChange = (key: keyof typeof emptyMetrics, value: string) => {
    setMetrics(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return alert("موقعیت مکانی هنوز دریافت نشده است.");

    const parsedMetrics: WaterMetrics = {
      chlorine: parseFloat(metrics.chlorine),
      ec: parseFloat(metrics.ec),
      ph: parseFloat(metrics.ph),
      turbidity: parseFloat(metrics.turbidity)
    };

    if (parsedMetrics.chlorine < 0 || parsedMetrics.chlorine > 5) return alert("مقدار کلر باید بین ۰ و ۵ باشد.");
    if (parsedMetrics.ph < 5 || parsedMetrics.ph > 9) return alert("مقدار pH باید بین ۵ و ۹ باشد.");
    if (parsedMetrics.turbidity < 0 || parsedMetrics.turbidity > 100) return alert("مقدار کدورت باید بین ۰ و ۱۰۰ باشد.");
    if (parsedMetrics.ec < 0 || parsedMetrics.ec > 5000) return alert("مقدار هدایت الکتریکی باید بین ۰ و ۵۰۰۰ باشد.");

    const newSample: WaterSample = {
      id: crypto.randomUUID(),
      samplerId,
      timestamp: Date.now(),
      location,
      metrics: parsedMetrics,
      notes
    };

    onSave(newSample);
    setMetrics(emptyMetrics);
    setNotes('');
    alert("داده با موفقیت ثبت شد!");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center gap-2">
          <span className="text-blue-600">📝</span> ثبت نمونه جدید
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 font-bold">نام نمونه‌بردار</label>
            <select
              value={samplerId}
              onChange={(e) => setSamplerId(e.target.value as SamplerID)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
            >
              {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-blue-800 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> موقعیت مکانی لحظه‌ای
              </span>
              {isLocating && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>
            {location ? (
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>عرض:</strong> {location.lat.toFixed(6)} | <strong>طول:</strong> {location.lng.toFixed(6)}</p>
                <p className="flex items-center gap-2">
                  <strong>دقت GPS:</strong> 
                  <span className={`${location.accuracy < 20 ? 'text-green-600' : 'text-amber-600'} font-bold`}>
                    {Math.round(location.accuracy)} متر
                  </span>
                </p>
                <p className="mt-2 text-gray-500 text-xs border-t border-blue-200 pt-1 leading-relaxed">
                  {location.address || 'در حال جستجوی آدرس...'}
                </p>
              </div>
            ) : (
              <div className="text-red-500 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {geoError ? `خطا: ${geoError}` : 'در حال انتظار برای دریافت سیگنال GPS...'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricInput label="کلر آزاد (mg/L)" value={metrics.chlorine} onChange={v => handleInputChange('chlorine', v)} min="0" max="5" step="0.01" placeholder="بازه: ۰ تا ۵" />
            <MetricInput label="pH" value={metrics.ph} onChange={v => handleInputChange('ph', v)} min="5" max="9" step="0.1" placeholder="بازه: ۵ تا ۹" />
            <MetricInput label="کدورت (NTU)" value={metrics.turbidity} onChange={v => handleInputChange('turbidity', v)} min="0" max="100" step="0.1" placeholder="بازه: ۰ تا ۱۰۰" />
            <MetricInput label="هدایت الکتریکی (µS/cm)" value={metrics.ec} onChange={v => handleInputChange('ec', v)} min="0" max="5000" step="1" placeholder="بازه: ۰ تا ۵۰۰۰" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 font-bold">توضیحات تکمیلی</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24 outline-none transition text-sm"
              placeholder="مشاهدات میدانی، وضعیت جوی و ..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setMetrics(emptyMetrics); setNotes(''); }} className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2 font-bold shadow-sm">
              <RotateCcw className="w-5 h-5" /> پاک کردن
            </button>
            <button type="submit" disabled={!location} className={`flex-1 py-3 px-4 rounded-lg text-white font-bold shadow-md transition flex items-center justify-center gap-2 ${location ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}>
              <Save className="w-5 h-5" /> ثبت و ارسال داده
            </button>
          </div>
        </form>
      </div>

      {/* Summary Section at the End of the Form */}
      <div className="mt-4 pt-6 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-4 text-gray-800 font-black text-lg">
          <BarChart className="w-5 h-5 text-blue-600" />
          <h3>خلاصه آماری ثبت نمونه</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Badge */}
          <div className="bg-blue-900 text-white p-4 rounded-xl flex flex-col items-center justify-center gap-1 shadow-md">
            <Layers className="w-6 h-6 text-cyan-400 mb-1" />
            <span className="text-xs opacity-80">کل نمونه‌های ثبت شده</span>
            <span className="text-3xl font-black">{samples.length}</span>
          </div>

          {/* Individual Samplers */}
          {SAMPLERS.map(s => (
            <div key={s} className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1 shadow-sm transition hover:shadow-md ${samplerColors[s] || 'bg-gray-50 text-gray-700'}`}>
              <User className="w-5 h-5 mb-1 opacity-70" />
              <span className="text-xs font-bold text-center">{s}</span>
              <span className="text-2xl font-black">{samplerStats[s]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MetricInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; min: string; max: string; step: string; placeholder: string }> = ({ label, value, onChange, min, max, step, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1 font-bold">{label}</label>
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition placeholder:text-gray-300 text-sm"
      required
    />
  </div>
);

export default DataEntryForm;