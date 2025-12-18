import React, { useState } from 'react';
import { WaterSample, SAMPLERS } from '../types';
import { Filter, FileSpreadsheet, Calendar, X } from 'lucide-react';

interface DataListProps {
  samples: WaterSample[];
}

const DataList: React.FC<DataListProps> = ({ samples }) => {
  const [filterSampler, setFilterSampler] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredSamples = samples.filter(s => {
    // Filter by Sampler
    if (filterSampler !== 'all' && s.samplerId !== filterSampler) {
        return false;
    }

    const sampleDate = new Date(s.timestamp);

    // Filter by Start Date (Local Time)
    if (startDate) {
        const parts = startDate.split('-');
        const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        start.setHours(0, 0, 0, 0);
        if (sampleDate < start) return false;
    }

    // Filter by End Date (Local Time)
    if (endDate) {
        const parts = endDate.split('-');
        const end = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        end.setHours(23, 59, 59, 999);
        if (sampleDate > end) return false;
    }

    return true;
  });

  const exportCSV = () => {
    const headers = ["ID,Sampler,Date,Latitude,Longitude,Address,Chlorine,EC,pH,Turbidity,Notes"];
    const rows = filteredSamples.map(s => 
      `"${s.id}","${s.samplerId}","${new Date(s.timestamp).toLocaleString('fa-IR')}","${s.location.lat}","${s.location.lng}","${s.location.address || ''}","${s.metrics.chlorine}","${s.metrics.ec}","${s.metrics.ph}","${s.metrics.turbidity}","${s.notes || ''}"`
    );
    
    // Add BOM for Excel UTF-8 compatibility
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aquaguard_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
      setFilterSampler('all');
      setStartDate('');
      setEndDate('');
  };

  const hasFilters = filterSampler !== 'all' || startDate !== '' || endDate !== '';

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Sampler Select */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto">
                <Filter className="text-gray-400 w-4 h-4" />
                <select 
                    value={filterSampler} 
                    onChange={e => setFilterSampler(e.target.value)}
                    className="bg-transparent text-sm outline-none w-full"
                >
                    <option value="all">همه نمونه‌بردارها</option>
                    {SAMPLERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto">
                <Calendar className="text-gray-400 w-4 h-4 shrink-0" />
                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="text-sm outline-none bg-transparent w-full sm:w-32"
                        title="از تاریخ"
                    />
                    <span className="text-gray-400">تا</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="text-sm outline-none bg-transparent w-full sm:w-32"
                        title="تا تاریخ"
                    />
                </div>
            </div>

            {/* Clear Button */}
            {hasFilters && (
                <button 
                    onClick={clearFilters}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                    title="حذف فیلترها"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>

        <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-bold w-full md:w-auto justify-center shadow-sm"
        >
            <FileSpreadsheet className="w-4 h-4" /> خروجی اکسل/CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 text-gray-700">
                <tr>
                    <th className="p-3">زمان</th>
                    <th className="p-3">نمونه‌بردار</th>
                    <th className="p-3">کلر (mg/L)</th>
                    <th className="p-3">pH</th>
                    <th className="p-3">مکان</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredSamples.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">
                            {samples.length === 0 ? 'داده‌ای یافت نشد.' : 'با فیلترهای انتخاب شده داده‌ای یافت نشد.'}
                        </td>
                    </tr>
                ) : filteredSamples.map(sample => (
                    <tr key={sample.id} className="hover:bg-blue-50 transition">
                        <td className="p-3 whitespace-nowrap">{new Date(sample.timestamp).toLocaleString('fa-IR')}</td>
                        <td className="p-3 font-medium">{sample.samplerId}</td>
                        <td className="p-3 text-blue-600 font-bold">{sample.metrics.chlorine}</td>
                        <td className="p-3">{sample.metrics.ph}</td>
                        <td className="p-3 truncate max-w-[200px]" title={sample.location.address}>
                            {sample.location.address || `${sample.location.lat.toFixed(4)}, ${sample.location.lng.toFixed(4)}`}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      
      <div className="bg-gray-50 p-2 text-xs text-gray-500 text-center border-t">
          تعداد ردیف: {filteredSamples.length}
      </div>
    </div>
  );
};

export default DataList;