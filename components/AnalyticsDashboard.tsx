
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, ScatterChart, Scatter
} from 'recharts';
import { WaterSample, MetricKey, METRIC_LABELS } from '../types';
import { calculateStats, calculateQQData } from '../utils/statistics';
import { Calculator, Activity, BarChart3, TrendingUp, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AnalyticsProps {
  samples: WaterSample[];
}

const AnalyticsDashboard: React.FC<AnalyticsProps> = ({ samples }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('chlorine');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const dataValues = useMemo(() => samples.map(s => s.metrics[selectedMetric]), [samples, selectedMetric]);
  const stats = useMemo(() => calculateStats(dataValues), [dataValues]);
  const qqData = useMemo(() => calculateQQData(dataValues), [dataValues]);

  const histogramData = useMemo(() => {
    if (!stats) return [];
    const binCount = Math.ceil(Math.sqrt(dataValues.length)) || 5;
    const binSize = (stats.max - stats.min) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
        range: `${(stats.min + i * binSize).toFixed(2)} - ${(stats.min + (i + 1) * binSize).toFixed(2)}`,
        count: 0,
        fullRangeStart: stats.min + i * binSize
    }));

    dataValues.forEach(v => {
        const index = Math.min(Math.floor((v - stats.min) / binSize), binCount - 1);
        if (bins[index]) bins[index].count++;
    });
    return bins;
  }, [dataValues, stats]);

  const trendData = useMemo(() => {
    return samples
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(s => ({
        time: new Date(s.timestamp).toLocaleDateString('fa-IR'),
        value: s.metrics[selectedMetric]
      }));
  }, [samples, selectedMetric]);

  const getAIInsight = async () => {
    if (!stats) return;
    setIsAnalyzing(true);
    try {
      // Fix: Initialize GoogleGenAI using direct process.env.API_KEY as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `As a water quality expert, analyze these statistics for ${METRIC_LABELS[selectedMetric]}:
      Mean: ${stats.mean}, Median: ${stats.median}, StdDev: ${stats.stdDev}, Min: ${stats.min}, Max: ${stats.max}, Normal Distribution: ${stats.isNormal}.
      Provide a concise 3-sentence insight in Persian about the quality and stability of the water based on these numbers. Focus on safety and trends.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      // Fix: Access response.text property directly (not a method)
      setAiInsight(response.text || "تحلیل در دسترس نیست.");
    } catch (e) {
      console.error(e);
      setAiInsight("خطا در برقراری ارتباط با هوش مصنوعی.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (samples.length < 2 || !stats) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow border border-gray-100">
        <p className="text-gray-500">برای مشاهده آمار، حداقل ۲ نمونه داده ثبت کنید.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-blue-600"/> تحلیل آماری
        </h2>
        <div className="flex gap-3 items-center">
            <button
                onClick={getAIInsight}
                disabled={isAnalyzing}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition disabled:opacity-50 text-sm font-bold"
            >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                تحلیل هوشمند (AI)
            </button>
            <select 
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
                className="p-2 border rounded-lg bg-gray-50 text-sm"
            >
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map(k => (
                    <option key={k} value={k}>{METRIC_LABELS[k]}</option>
                ))}
            </select>
        </div>
      </div>

      {aiInsight && (
        <div className="bg-blue-900 text-blue-50 p-6 rounded-xl shadow-inner border border-blue-700 animate-in fade-in slide-in-from-top-4 duration-500">
            <h4 className="flex items-center gap-2 font-black mb-2 text-cyan-300">
                <Sparkles className="w-4 h-4"/> بینش کارشناس هوش مصنوعی:
            </h4>
            <p className="text-sm leading-relaxed font-medium">{aiInsight}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="میانگین (Mean)" value={stats.mean.toFixed(3)} />
        <StatCard label="میانه (Median)" value={stats.median.toFixed(3)} />
        <StatCard label="انحراف معیار (SD)" value={stats.stdDev.toFixed(3)} />
        <StatCard 
            label="تست نرمال (JB)" 
            value={stats.isNormal ? "نرمال ✅" : "غیر نرمال ❌"} 
            subValue={`JB: ${stats.jarqueBera.toFixed(2)}`}
        />
        <StatCard label="چولگی (Skewness)" value={stats.skewness.toFixed(3)} />
        <StatCard label="کشیدگی (Kurtosis)" value={stats.kurtosis.toFixed(3)} />
        <StatCard label="بازه اطمینان 95%" value={`[${stats.confidenceInterval[0].toFixed(2)}, ${stats.confidenceInterval[1].toFixed(2)}]`} className="col-span-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow border border-gray-100 h-80">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-700">
                <BarChart3 className="w-4 h-4"/> هیستوگرام توزیع
            </h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" style={{ fontSize: '10px' }} interval={0}/>
                    <YAxis allowDecimals={false}/>
                    <RechartsTooltip wrapperStyle={{ fontFamily: 'Vazirmatn' }}/>
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="تعداد" />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border border-gray-100 h-80">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-700">
                <Calculator className="w-4 h-4"/> نمودار Q-Q (تست نرمال)
            </h3>
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid />
                    <XAxis type="number" dataKey="x" name="تئوری" label={{ value: 'چندک‌های نرمال', position: 'bottom', offset: 0 }} />
                    <YAxis type="number" dataKey="y" name="نمونه" label={{ value: 'مقادیر', angle: -90, position: 'insideLeft' }} />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} wrapperStyle={{ fontFamily: 'Vazirmatn' }}/>
                    <Scatter name="Q-Q" data={qqData} fill="#8884d8" />
                </ScatterChart>
            </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border border-gray-100 h-80 col-span-1 lg:col-span-2">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-700">
                <TrendingUp className="w-4 h-4"/> روند زمانی
            </h3>
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip wrapperStyle={{ fontFamily: 'Vazirmatn' }}/>
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} name="مقدار" />
                </LineChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; subValue?: string; className?: string }> = ({ label, value, subValue, className }) => (
  <div className={`bg-gray-50 p-4 rounded-lg border border-gray-200 ${className}`}>
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className="text-lg font-bold text-gray-800">{value}</div>
    {subValue && <div className="text-xs text-blue-600 mt-1">{subValue}</div>}
  </div>
);

export default AnalyticsDashboard;
