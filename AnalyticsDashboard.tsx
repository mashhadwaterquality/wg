
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, Cell
} from 'recharts';
import { WaterSample, MetricKey, METRIC_LABELS, SAMPLERS } from './types';
import { 
  calculateStats, 
  calculateBenfordAnalysis, 
  calculateQQDataFromSamples,
  calculateCorrelation
} from './utils/statistics';
import { calculateDistance } from './utils/geo';
import { 
  BarChart3, Sparkles, Loader2,
  Trophy, Award, Medal,
  ShieldAlert, Fingerprint, Activity, Zap, Timer, GitCompare, BarChart as FrequencyIcon
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AnalyticsProps {
  samples: WaterSample[];
}

interface SamplerDailyStat {
  date: string;
  avgTime: number;
  avgDist: number;
  sampleCount: number;
}

interface RankingItem {
  samplerId: string;
  globalScore: number;
  totalSamples: number;
  violations: number;
}

const AnalyticsDashboard: React.FC<AnalyticsProps> = ({ samples }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'forensics' | 'operational' | 'integrity' | 'correlation' | 'distribution'>('integrity');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('chlorine');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const samplerColors: Record<string, string> = {
    'محمدرضا ابتکاری': '#3b82f6',
    'ابوالفضل شرقی': '#8b5cf6',
    'سعید محرری': '#ec4899',
  };

  const dataValues = useMemo(() => 
    samples.map(s => s.metrics[selectedMetric] as number).filter(v => v !== null && v !== undefined), 
  [samples, selectedMetric]);
  
  const stats = useMemo(() => calculateStats(dataValues), [dataValues]);
  const benfordData = useMemo(() => calculateBenfordAnalysis(dataValues), [dataValues]);
  const qqData = useMemo(() => calculateQQDataFromSamples(samples, selectedMetric), [samples, selectedMetric]);

  const frequencyData = useMemo(() => {
    const bins: Record<string, Record<string, number>> = {};
    SAMPLERS.forEach(s => bins[s] = {});

    samples.forEach(sample => {
      const val = sample.metrics[selectedMetric];
      if (val === null || val === undefined) return;
      let rounded: string;
      
      if (selectedMetric === 'ec') {
        rounded = (Math.round(val / 50) * 50).toString();
      } else if (selectedMetric === 'ph' || selectedMetric === 'chlorine') {
        rounded = val.toFixed(1);
      } else {
        rounded = Math.round(val).toString();
      }

      bins[sample.samplerId][rounded] = (bins[sample.samplerId][rounded] || 0) + 1;
    });

    const allXValues = new Set<string>();
    SAMPLERS.forEach(s => Object.keys(bins[s]).forEach(v => allXValues.add(v)));
    
    return Array.from(allXValues)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .map(val => {
        const row: any = { value: val };
        SAMPLERS.forEach(s => {
          row[s] = bins[s][val] || 0;
        });
        return row;
      });
  }, [samples, selectedMetric]);

  const correlationData = useMemo(() => {
    return SAMPLERS.map(samplerId => {
      const sSamples = samples.filter(s => s.samplerId === samplerId);
      if (sSamples.length < 3) return { samplerId, data: [] };

      const cl = sSamples.map(s => s.metrics.chlorine);
      const ph = sSamples.map(s => s.metrics.ph);
      const ec = sSamples.map(s => s.metrics.ec);
      const turb = sSamples.map(s => s.metrics.turbidity || 0);

      return {
        samplerId,
        data: [
          { axis: 'Cl-pH', value: Math.abs(calculateCorrelation(cl, ph)) * 100 },
          { axis: 'Cl-EC', value: Math.abs(calculateCorrelation(cl, ec)) * 100 },
          { axis: 'pH-EC', value: Math.abs(calculateCorrelation(ph, ec)) * 100 },
          { axis: 'EC-Turb', value: Math.abs(calculateCorrelation(ec, turb)) * 100 },
          { axis: 'pH-Turb', value: Math.abs(calculateCorrelation(ph, turb)) * 100 },
          { axis: 'Cl-Turb', value: Math.abs(calculateCorrelation(cl, turb)) * 100 },
        ]
      };
    });
  }, [samples]);

  const operationalStats = useMemo(() => {
    const samplerStats: Record<string, SamplerDailyStat[]> = {};
    SAMPLERS.forEach(samplerId => {
      const samplerSamples = samples.filter(s => s.samplerId === samplerId);
      const dayGroups: Record<string, WaterSample[]> = {};

      samplerSamples.forEach(s => {
        const d = new Date(s.timestamp).toLocaleDateString('fa-IR');
        if (!dayGroups[d]) dayGroups[d] = [];
        dayGroups[d].push(s);
      });

      const dailyResults: SamplerDailyStat[] = [];
      Object.entries(dayGroups).forEach(([date, daySamples]) => {
        const sorted = [...daySamples].sort((a, b) => a.timestamp - b.timestamp);
        let validTimeSum = 0;
        let validDistSum = 0;
        let validIntervalCount = 0;

        for (let i = 1; i < sorted.length; i++) {
          const s1 = sorted[i - 1];
          const s2 = sorted[i];
          const timeDiff = (s2.timestamp - s1.timestamp) / (1000 * 60); 
          const distDiff = calculateDistance(s1.location.lat, s1.location.lng, s2.location.lat, s2.location.lng);

          if (timeDiff <= 20 && distDiff <= 1000) {
            validTimeSum += timeDiff;
            validDistSum += distDiff;
            validIntervalCount++;
          }
        }

        dailyResults.push({
          date,
          avgTime: validIntervalCount > 0 ? validTimeSum / validIntervalCount : 0,
          avgDist: validIntervalCount > 0 ? validDistSum / validIntervalCount : 0,
          sampleCount: daySamples.length
        });
      });
      samplerStats[samplerId] = dailyResults;
    });
    return samplerStats;
  }, [samples]);

  const gradientViolations = useMemo(() => {
    const violations: { samplerId: string; metric: string; val1: number; val2: number; dist: number; id: string }[] = [];
    SAMPLERS.forEach(samplerId => {
      const sorted = samples.filter(s => s.samplerId === samplerId).sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 1; i < sorted.length; i++) {
        const s1 = sorted[i-1];
        const s2 = sorted[i];
        const dist = calculateDistance(s1.location.lat, s1.location.lng, s2.location.lat, s2.location.lng);
        if (dist < 300 && dist > 1) {
          if (Math.abs(s1.metrics.chlorine - s2.metrics.chlorine) > 0.8) 
            violations.push({ samplerId, metric: 'کلر', val1: s1.metrics.chlorine, val2: s2.metrics.chlorine, dist, id: s2.id });
          if (Math.abs(s1.metrics.ph - s2.metrics.ph) > 1.2) 
            violations.push({ samplerId, metric: 'pH', val1: s1.metrics.ph, val2: s2.metrics.ph, dist, id: s2.id });
        }
      }
    });
    return violations;
  }, [samples]);

  const rankingData = useMemo<RankingItem[]>(() => {
    return SAMPLERS.map(samplerId => {
      const samplerSamples = samples.filter(s => s.samplerId === samplerId);
      if (samplerSamples.length === 0) return { samplerId, globalScore: 0, totalSamples: 0, violations: 0 };
      
      let penalty = 0;
      const vCount = gradientViolations.filter(v => v.samplerId === samplerId).length;
      penalty += vCount * 12;

      const metricsKeys = Object.keys(METRIC_LABELS) as MetricKey[];
      metricsKeys.forEach(mKey => {
        const vals = samplerSamples.map(s => s.metrics[mKey] as number).filter(v => v !== null && v !== undefined);
        const sStats = calculateStats(vals);
        if (sStats && !sStats.isNormal && samplerSamples.length > 5) penalty += 4;
      });

      return { samplerId, globalScore: Math.max(0, 100 - penalty), totalSamples: samplerSamples.length, violations: vCount };
    }).sort((a, b) => b.globalScore - a.globalScore);
  }, [samples, gradientViolations]);

  const getAIInsight = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = `Water Quality Forensics Dashboard. Analysis of ${samples.length} samples. Detected anomalies: ${gradientViolations.length}. Best performing sampler: ${rankingData[0]?.samplerId}. Provide a professional 2-sentence quality report in Persian summarizing the overall health and sampler integrity.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: context }] }],
      });
      
      setAiInsight(response.text || "تحلیل در دسترس نیست.");
    } catch (e) {
      console.error("AI Analysis Error:", e);
      setAiInsight("خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-max overflow-x-auto no-scrollbar shadow-inner">
        <button onClick={() => setActiveSubTab('integrity')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'integrity' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Trophy className="w-4 h-4" /> رتبه‌بندی
        </button>
        <button onClick={() => setActiveSubTab('distribution')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'distribution' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <FrequencyIcon className="w-4 h-4" /> فراوانی مقادیر
        </button>
        <button onClick={() => setActiveSubTab('operational')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'operational' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <Timer className="w-4 h-4" /> سرعت عملیاتی
        </button>
        <button onClick={() => setActiveSubTab('correlation')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'correlation' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <GitCompare className="w-4 h-4" /> همبستگی
        </button>
        <button onClick={() => setActiveSubTab('forensics')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'forensics' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
          <ShieldAlert className="w-4 h-4" /> ممیزی رفتاری
        </button>
        <button onClick={() => setActiveSubTab('stats')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'stats' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
          <Activity className="w-4 h-4" /> نرمالیته
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gray-50 text-gray-800 border">
                <BarChart3 className="w-6 h-6"/>
            </div>
            <div>
                <h2 className="text-xl font-black text-gray-800">داشبورد ممیزی داده</h2>
                <p className="text-xs text-gray-500 font-bold">پایش علمی و جرم‌شناسی آماری داده‌های کیفی</p>
            </div>
        </div>
        <div className="flex gap-3">
          <button onClick={getAIInsight} disabled={isAnalyzing} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition disabled:opacity-50 text-xs font-bold shadow-lg">
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-cyan-400"/>} گزارش هوشمند
          </button>
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value as MetricKey)} className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500">
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map(k => <option key={k} value={k}>{METRIC_LABELS[k]}</option>)}
          </select>
        </div>
      </div>

      {aiInsight && (
        <div className="bg-blue-900 text-blue-50 border-r-8 border-cyan-400 p-5 rounded-2xl shadow-xl animate-in fade-in slide-in-from-right-4 duration-500">
            <p className="text-sm leading-relaxed font-medium">{aiInsight}</p>
        </div>
      )}

      {/* TABS CONTENT */}
      {activeSubTab === 'distribution' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <FrequencyIcon className="w-5 h-5 text-indigo-600" /> توزیع فراوانی مقادیر: {METRIC_LABELS[selectedMetric]}
          </h3>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frequencyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="value" fontSize={10} label={{ value: METRIC_LABELS[selectedMetric], position: 'insideBottom', offset: -10, fontSize: 11, fontWeight: 'bold' }} />
                <YAxis fontSize={10} label={{ value: 'فراوانی (تعداد)', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 'bold' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', direction: 'rtl' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                {SAMPLERS.map(sampler => (
                  <Bar key={sampler} dataKey={sampler} fill={samplerColors[sampler]} name={sampler} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeSubTab === 'correlation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {correlationData.map((sampler, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h3 className="font-black text-sm mb-4 border-b pb-2 w-full text-center" style={{ color: samplerColors[sampler.samplerId] }}>
                {sampler.samplerId}
              </h3>
              <div className="h-64 w-full">
                {sampler.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={sampler.data}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="axis" fontSize={10} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar 
                        name={sampler.samplerId} 
                        dataKey="value" 
                        stroke={samplerColors[sampler.samplerId]} 
                        fill={samplerColors[sampler.samplerId]} 
                        fillOpacity={0.6} 
                      />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', direction: 'rtl' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-400 italic">داده کافی موجود نیست</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'forensics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-800 flex items-center gap-2 mb-6">
                <Fingerprint className="text-blue-600 w-5 h-5"/> تحلیل بنفورد (توزیع رقم اول)
              </h3>
              <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={benfordData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="digit" fontSize={10} stroke="#94a3b8" />
                          <YAxis fontSize={10} stroke="#94a3b8" />
                          <RechartsTooltip contentStyle={{ borderRadius: '12px' }} />
                          <Legend verticalAlign="top" height={36} />
                          <Bar name="توزیع واقعی" dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar name="توزیع ایده‌آل" dataKey="expected" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black text-red-600 flex items-center gap-2 mb-6">
                <Zap className="w-5 h-5"/> موارد مشکوک گرادیان فیزیکی
              </h3>
              <div className="overflow-x-auto h-72">
                  <table className="w-full text-xs text-right">
                      <thead className="bg-red-50 text-red-700 sticky top-0">
                          <tr>
                            <th className="p-3">نمونه‌بردار</th>
                            <th className="p-3">پارامتر</th>
                            <th className="p-3">تغییر</th>
                            <th className="p-3">فاصله</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {gradientViolations.length === 0 ? (
                            <tr><td colSpan={4} className="p-12 text-center text-gray-400 italic">مورد مشکوکی یافت نشد.</td></tr>
                          ) : (
                            gradientViolations.map((v, i) => (
                                <tr key={i} className="hover:bg-red-50/30 transition">
                                  <td className="p-3 font-bold">{v.samplerId}</td>
                                  <td className="p-3">{v.metric}</td>
                                  <td className="p-3 font-black text-red-600">{Math.abs(v.val1 - v.val2).toFixed(2)}</td>
                                  <td className="p-3 font-medium">{Math.round(v.dist)}m</td>
                                </tr>
                            ))
                          )}
                      </tbody>
                  </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'integrity' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-12">
          <RankingCard rank={2} data={rankingData[1]} color="border-gray-200 bg-gray-50/50" icon={<Medal className="w-10 h-10 text-gray-400" />} badgeColor="bg-gray-400" samplerColor={samplerColors[rankingData[1]?.samplerId]} />
          <div className="relative -top-6">
            <RankingCard rank={1} data={rankingData[0]} color="border-yellow-400 ring-8 ring-yellow-50 bg-white" icon={<Trophy className="w-16 h-16 text-yellow-500 drop-shadow-lg" />} badgeColor="bg-yellow-500" isWinner samplerColor={samplerColors[rankingData[0]?.samplerId]} />
          </div>
          <RankingCard rank={3} data={rankingData[2]} color="border-orange-100 bg-orange-50/20" icon={<Award className="w-10 h-10 text-orange-400" />} badgeColor="bg-orange-600" samplerColor={samplerColors[rankingData[2]?.samplerId]} />
        </div>
      )}
    </div>
  );
};

const RankingCard: React.FC<{ 
  rank: number; 
  data: RankingItem | undefined; 
  color: string; 
  icon: React.ReactNode; 
  badgeColor: string; 
  isWinner?: boolean; 
  samplerColor?: string 
}> = ({ rank, data, color, icon, badgeColor, isWinner, samplerColor }) => (
  <div className={`relative p-8 rounded-[3rem] shadow-2xl border-4 flex flex-col items-center transition-all duration-300 ${color} ${isWinner ? 'scale-105' : 'hover:translate-y-2'}`}>
    <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl ring-8 ring-white ${badgeColor}`}>{rank}</div>
    <div className="mb-6">{icon}</div>
    <h3 className="text-xl font-black text-gray-800 mb-2" style={{ color: samplerColor }}>{data?.samplerId || 'درحال ممیزی'}</h3>
    <div className="grid grid-cols-2 gap-3 w-full mb-6 mt-4">
        <div className="bg-gray-50 p-2.5 rounded-2xl text-center"><span className="text-[9px] text-gray-400 block font-bold">تخلفات</span><span className="text-sm font-black text-red-600">{data?.violations || 0}</span></div>
        <div className="bg-gray-50 p-2.5 rounded-2xl text-center"><span className="text-[9px] text-gray-400 block font-bold">نمونه‌ها</span><span className="text-sm font-black">{data?.totalSamples || 0}</span></div>
    </div>
    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">امتیاز یکپارچگی</div>
    <div className={`text-5xl font-black ${isWinner ? 'text-yellow-600' : 'text-gray-800'}`}>{data?.globalScore ? data.globalScore.toFixed(1) : '0.0'}%</div>
  </div>
);

export default AnalyticsDashboard;
