import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Save, RotateCcw, Loader2 } from 'lucide-react';
import { SamplerID, WaterSample, WaterMetrics, GeoLocation, SAMPLERS } from '../types';
import { getAddressFromCoords, calculateDistance } from '../utils/geo';

interface DataEntryFormProps {
  onSave: (sample: WaterSample) => void;
}

const initialMetrics: WaterMetrics = {
  chlorine: 0,
  ec: 0,
  ph: 7,
  turbidity: 0
};

const DataEntryForm: React.FC<DataEntryFormProps> = ({ onSave }) => {
  const [samplerId, setSamplerId] = useState<SamplerID>('Sampler 1');
  const [metrics, setMetrics] = useState<WaterMetrics>(initialMetrics);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // Ref to store the timeout ID so we can cancel it
  const debounceRef = useRef<number | null>(null);

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    const addr = await getAddressFromCoords(lat, lng);
    setLocation(prev => prev ? { ...prev, address: addr } : null);
  }, []);

  const updateLocation = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = pos.coords;
    
    setLocation(prev => {
      // If we moved significantly (> 50m) or don't have an address yet, fetch it
      const shouldFetchAddress = !prev || !prev.address || 
        calculateDistance(prev.lat, prev.lng, latitude, longitude) > 50;

      if (shouldFetchAddress) {
        // Clear previous pending request to respect API Rate Limits (1 req/sec)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        
        // Schedule new request with 1.5s delay to ensure stability
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      alert("موقعیت مکانی هنوز دریافت نشده است.");
      return;
    }

    const newSample: WaterSample = {
      id: crypto.randomUUID(),
      samplerId,
      timestamp: Date.now(),
      location,
      metrics,
      notes
    };

    onSave(newSample);
    
    // Reset non-sticky fields
    setMetrics(initialMetrics);
    setNotes('');
    alert("داده با موفقیت ثبت شد!");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2 flex items-center gap-2">
        <span className="text-blue-600">📝</span> ثبت نمونه جدید
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sampler ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">شناسه نمونه‌بردار</label>
          <select
            value={samplerId}
            onChange={(e) => setSamplerId(e.target.value as SamplerID)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
          >
            {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Geolocation Status */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-blue-800 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> موقعیت مکانی
            </span>
            {isLocating && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          </div>
          
          {location ? (
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>عرض جغرافیایی:</strong> {location.lat.toFixed(6)}</p>
              <p><strong>طول جغرافیایی:</strong> {location.lng.toFixed(6)}</p>
              <p className="flex items-center gap-2">
                <strong>دقت:</strong> 
                <span className={`${location.accuracy < 20 ? 'text-green-600' : 'text-amber-600'} font-bold`}>
                  {Math.round(location.accuracy)} متر
                </span>
              </p>
              <p className="mt-2 text-gray-500 text-xs border-t border-blue-200 pt-1">
                {location.address || 'در حال جستجوی آدرس...'}
              </p>
            </div>
          ) : (
            <div className="text-red-500 text-sm">
              {geoError ? `خطا: ${geoError}` : 'در حال انتظار برای GPS...'}
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کلر آزاد (mg/L)</label>
            <input
              type="number"
              step="0.01"
              value={metrics.chlorine}
              onChange={e => setMetrics({...metrics, chlorine: parseFloat(e.target.value)})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">pH</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="14"
              value={metrics.ph}
              onChange={e => setMetrics({...metrics, ph: parseFloat(e.target.value)})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کدورت (NTU)</label>
            <input
              type="number"
              step="0.1"
              value={metrics.turbidity}
              onChange={e => setMetrics({...metrics, turbidity: parseFloat(e.target.value)})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">هدایت الکتریکی (µS/cm)</label>
            <input
              type="number"
              step="1"
              value={metrics.ec}
              onChange={e => setMetrics({...metrics, ec: parseFloat(e.target.value)})}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات (اختیاری)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="مشاهدات میدانی..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setMetrics(initialMetrics)}
            className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" /> پاک کردن
          </button>
          <button
            type="submit"
            disabled={!location}
            className={`flex-1 py-3 px-4 rounded-lg text-white font-bold shadow-md transition flex items-center justify-center gap-2
              ${location ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}
            `}
          >
            <Save className="w-5 h-5" /> ثبت اطلاعات
          </button>
        </div>
      </form>
    </div>
  );
};

export default DataEntryForm;