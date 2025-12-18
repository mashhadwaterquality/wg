
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, ComposedChart, Legend, Cell, ScatterChart, Scatter, ZAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { WaterSample, MetricKey, METRIC_LABELS, SAMPLERS } from '../types';
import { 
  calculateStats, 
  calculateBenfordAnalysis, 
  calculateLastDigitDistribution, 
  calculateQQData,
  calculateCorrelation
} from '../utils/statistics';
import { calculateDistance } from '../utils/geo';
import { 
  BarChart3, Sparkles, Loader2, 
  ShieldCheck, UserCheck, 
  Fingerprint, LineChart as LineIcon, 
  TrendingUp, Users, GitCompare, FlaskConical, Trophy, Award, Medal, Search, Star, ShieldAlert
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface AnalyticsProps {
  samples: WaterSample[];
}

const AnalyticsDashboard: React.FC<AnalyticsProps> = ({ samples }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'performance' | 'integrity' | 'comparative'>('integrity');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('chlorine');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // General Stats for the selected metric
  const dataValues = useMemo(() => samples.map(s => s.metrics[selectedMetric]), [samples, selectedMetric]);
  const stats = useMemo(() => calculateStats(dataValues), [dataValues]);
  
  const histogramData = useMemo(() => {
    if (dataValues.length === 0 || !stats) return [];
    
    const min = stats.min;
    const max = stats.max;
    const range = max - min;
    const bins = 8;
    const binSize = range / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => ({
      range: binSize === 0 ? min.toFixed(2) : `${(min + i * binSize).toFixed(2)}`,
      count: 0
    }));

    dataValues.forEach(v => {
      let index = binSize === 0 ? 0 : Math.floor((v - min) / binSize);
      if (index >= bins) index = bins - 1;
      if (index < 0) index = 0;
      histogram[index].count++;
    });

    return histogram;
  }, [dataValues, stats]);

  const benfordData = useMemo(() => calculateBenfordAnalysis(dataValues), [dataValues]);
  const lastDigitData = useMemo(() => calculateLastDigitDistribution(dataValues), [dataValues]);
  const qqPlotData = useMemo(() => calculateQQData(dataValues), [dataValues]);

  // Inter-Parameter Consistency Data
  const correlationMatrix = useMemo(() => {
    const keys = Object.keys(METRIC_LABELS) as MetricKey[];
    const matrix: any[] = [];
    keys.forEach(k1 => {
      const row: any = { metric: METRIC_LABELS[k1] };
      keys.forEach(k2 => {
        if (k1 === k2) row[k2] = 1;
        else {
          const x = samples.map(s => s.metrics[k1]);
          const y = samples.map(s => s.metrics[k2]);
          row[k2] = calculateCorrelation(x, y);
        }
      });
      matrix.push(row);
    });
    return matrix;
  }, [samples]);

  const scatterData = useMemo(() => {
    const xKey: MetricKey = 'ec';
    const yKey: MetricKey = 'turbidity';
    return samples.map(s => ({
      x: s.metrics[xKey],
      y: s.metrics[yKey],
      sampler: s.samplerId
    }));
  }, [samples]);

  // Radar Data for Sampler Comparison
  const samplerRadarData = useMemo(() => {
    const metricsKeys = Object.keys(METRIC_LABELS) as MetricKey[];
    return metricsKeys.map(key => {
      const obj: any = { subject: METRIC_LABELS[key], fullMark: 100 };
      SAMPLERS.forEach(sampler => {
        const samplerVals = samples.filter(s => s.samplerId === sampler).map(s => s.metrics[key]);
        const samplerAvg = samplerVals.length > 0 ? samplerVals.reduce((a, b) => a + b, 0) / samplerVals.length : 0;
        const totalAvg = samples.map(s => s.metrics[key]).reduce((a, b) => a + b, 0) / samples.length;
        obj[sampler] = totalAvg === 0 ? 0 : (samplerAvg / totalAvg) * 100;
      });
      return obj;
    });
  }, [samples]);

  // Holistic Ranking Calculations (Global across all metrics)
  const rankingData = useMemo(() => {
    const metricsKeys = Object.keys(METRIC_LABELS) as MetricKey[];
    const results = SAMPLERS.map(samplerId => {
      const samplerSamples = samples
        .filter(s => s.samplerId === samplerId)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (samplerSamples.length === 0) return { samplerId, globalScore: 0, totalSamples: 0, flags: [] };

      let totalIntegrity = 0;
      const allFlags: string[] = [];

      metricsKeys.forEach(key => {
        let metricPenalty = 0;
        const populationStats = calculateStats(samples.map(s => s.metrics[key]));
        const samplerMetrics = samplerSamples.map(s => s.metrics[key]);
        const samplerStats = calculateStats(samplerMetrics);

        if (samplerStats && populationStats && populationStats.stdDev > 0) {
          const varianceRatio = samplerStats.stdDev / populationStats.stdDev;
          if (varianceRatio < 0.25 && samplerSamples.length > 4) metricPenalty += 20;
          
          const devPercent = Math.abs(samplerStats.mean - populationStats.mean) / populationStats.mean;
          if (devPercent > 0.4 && samplerSamples.length > 5) metricPenalty += 15;
          
          if (!samplerStats.isNormal && populationStats.isNormal) metricPenalty += 10;
        }

        if (key === 'ec' || key === 'turbidity') {
          const benford = calculateBenfordAnalysis(samplerMetrics);
          const deviation = benford.reduce((acc, d) => acc + Math.abs(d.actual - d.expected), 0);
          if (deviation > 50 && samplerSamples.length > 8) metricPenalty += 15;
        }

        totalIntegrity += Math.max(0, 100 - metricPenalty);
      });

      let spatialPenalty = 0;
      for (let i = 1; i < samplerSamples.length; i++) {
        const s1 = samplerSamples[i-1];
        const s2 = samplerSamples[i];
        const dist = calculateDistance(s1.location.lat, s1.location.lng, s2.location.lat, s2.location.lng);
        const timeDiff = (s2.timestamp - s1.timestamp) / (1000 * 60);
        if (timeDiff > 0 && (dist / 1000) / (timeDiff / 60) > 130) {
          allFlags.push("سرعت غیرمجاز جابجایی");
          spatialPenalty = 20;
          break;
        }
      }

      const avgIntegrity = totalIntegrity / metricsKeys.length;
      const finalGlobalScore = Math.max(0, avgIntegrity - spatialPenalty);

      return {
        samplerId,
        globalScore: finalGlobalScore,
        totalSamples: samplerSamples.length,
        flags: allFlags
      };
    });

    return results.sort((a, b) => b.globalScore - a.globalScore);
  }, [samples]);

  const getAIInsight = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const rankingText = rankingData.map((d, i) => `${i+1}. ${d.samplerId} (${d.globalScore.toFixed(1)}%)`).join(', ');
      const prompt = `Water Quality Forensics - Sampler Rankings:
      Leaderboard: ${rankingText}
      Criterion: Overall reliability across Chlorine, pH, EC, and Turbidity.
      Provide a professional summary in Persian (max 2 sentences) about data reliability and any significant outliers.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setAiInsight(response.text || "تحلیل در دسترس نیست.");
    } catch (e) {
      setAiInsight("خطا در هوش مصنوعی.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const samplerColors: Record<string, string> = {
    'محمدرضا ابتکاری': '#3b82f6',
    'ابوالفضل شرقی': '#8b5cf6',
    'سعید محرری': '#ec4899',
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-max overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveSubTab('integrity')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'integrity' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>
          <Trophy className="w-4 h-4" /> رتبه‌بندی جامع
        </button>
        <button onClick={() => setActiveSubTab('comparative')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'comparative' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>
          <GitCompare className="w-4 h-4" /> مقایسه سیستمی
        </button>
        <button onClick={() => setActiveSubTab('stats')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'stats' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          <BarChart3 className="w-4 h-4" /> تحلیل توزیع
        </button>
        <button onClick={() => setActiveSubTab('performance')} className={`flex-none px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'performance' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>
          <UserCheck className="w-4 h-4" /> ممیزی فردی
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
            {activeSubTab === 'integrity' && <><Award className="text-red-600 w-5 h-5"/> رده‌بندی کیفی نمونه‌برداران</>}
            {activeSubTab === 'comparative' && <><GitCompare className="text-indigo-600 w-5 h-5"/> همبستگی و بایاس متقابل</>}
            {activeSubTab === 'stats' && <><LineIcon className="text-blue-600 w-5 h-5"/> وضعیت متغیرهای پایش</>}
            {activeSubTab === 'performance' && <><ShieldCheck className="text-purple-600 w-5 h-5"/> پایش دقت عملکرد</>}
        </h2>
        <div className="flex gap-3 items-center">
            <button onClick={getAIInsight} disabled={isAnalyzing} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-xs font-bold shadow-sm">
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                گزارش ممیزی AI
            </button>
            <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value as MetricKey)} className="p-2 border rounded-lg bg-gray-50 text-xs font-bold outline-none border-gray-200">
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map(k => (
                    <option key={k} value={k}>{METRIC_LABELS[k]}</option>
                ))}
            </select>
        </div>
      </div>

      {aiInsight && (
        <div className="bg-red-50 border-r-4 border-red-600 p-4 rounded-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <p className="text-sm leading-relaxed text-red-900 font-medium">{aiInsight}</p>
        </div>
      )}

      {activeSubTab === 'integrity' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8">
            <div className="order-2 md:order-1">
              <RankingCard rank={2} data={rankingData[1]} color="border-gray-200" icon={<Medal className="w-8 h-8 text-gray-400" />} badgeColor="bg-gray-400" />
            </div>
            <div className="order-1 md:order-2">
              <RankingCard rank={1} data={rankingData[0]} color="border-yellow-400 ring-8 ring-yellow-50" icon={<Trophy className="w-12 h-12 text-yellow-500" />} badgeColor="bg-yellow-500" isWinner />
            </div>
            <div className="order-3">
              <RankingCard rank={3} data={rankingData[2]} color="border-orange-100" icon={<Award className="w-8 h-8 text-orange-400" />} badgeColor="bg-orange-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-gray-800 flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-red-500" /> معیارهای رتبه‌بندی هوشمند
              </h3>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold">۱</div>
                  <p><strong>توزیع آماری:</strong> انطباق داده‌ها با منحنی توزیع نرمال و بایاس سیستماتیک.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold">۲</div>
                  <p><strong>پایداری واریانس:</strong> تشخیص داده‌سازی‌های غیرواقعی با بررسی ثبات نامتعارف پراکندگی.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold">۳</div>
                  <p><strong>قانون بنفورد:</strong> بررسی فرکانس ارقام برای کشف الگوهای ذهنی انسانی در اعداد ثبت شده.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold">۴</div>
                  <p><strong>صحت جابجایی:</strong> تطبیق زمان و فاصله بین نقاط نمونه‌برداری با سرعت‌های تردد منطقی.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center items-center text-center">
                <div className="relative">
                  <Star className="w-16 h-16 text-yellow-400 mb-4 fill-current animate-pulse" />
                  <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-blue-400 animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">معتبرترین عملکرد</h3>
                <div className="text-blue-600 font-black text-xl mb-4">{rankingData[0]?.samplerId}</div>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                  الگوهای ثبت شده توسط ایشان بیشترین همبستگی را با متغیرهای طبیعی محیطی نشان می‌دهد.
                </p>
            </div>
          </div>
        </div>
      )}

      {/* Rest of the sub-tabs remain consistent with previous implementation logic but with refined styling */}
      {activeSubTab === 'comparative' && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
                <h3 className="font-black text-gray-800 flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-500"/> نیم‌رخ مقایسه‌ای پارامترها (Radar)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={samplerRadarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" fontSize={10} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} hide />
                    {SAMPLERS.map(s => (
                      <Radar 
                        key={s} 
                        name={s} 
                        dataKey={s} 
                        stroke={samplerColors[s]} 
                        fill={samplerColors[s]} 
                        fillOpacity={0.2} 
                      />
                    ))}
                    <Legend iconType="circle" />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
                <h3 className="font-black text-gray-800 flex items-center gap-2 mb-4">
                  <FlaskConical className="w-5 h-5 text-pink-500"/> سازگاری فیزیکوشیمیایی (EC vs Turbidity)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="x" name="EC" label={{ value: 'EC (µS/cm)', position: 'insideBottom', offset: -5, fontSize: 10 }} fontSize={10} />
                    <YAxis type="number" dataKey="y" name="Turbidity" label={{ value: 'کدورت (NTU)', angle: -90, position: 'insideLeft', fontSize: 10 }} fontSize={10} />
                    <ZAxis type="number" range={[50, 50]} />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend verticalAlign="top" />
                    {SAMPLERS.map(s => (
                      <Scatter key={s} name={s} data={scatterData.filter(d => d.sampler === s)} fill={samplerColors[s]} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="font-black text-gray-800 flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-blue-500"/> هیستوگرام و منحنی توزیع فرکانسی
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="range" fontSize={10} />
                    <YAxis hide />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-black text-gray-800 flex items-center gap-2 mb-6 border-b pb-3">
                <ShieldCheck className="w-5 h-5 text-green-500"/> شاخص نرمالیته داده
              </h3>
              <div className="flex-1 flex flex-col justify-center items-center text-center">
                <div className={`text-4xl font-black mb-2 ${stats?.isNormal ? 'text-green-600' : 'text-amber-600'}`}>
                  {stats?.isNormal ? 'توزیع نرمال' : 'غیر نرمال'}
                </div>
                <p className="text-xs text-gray-500 mb-6">Jarque-Bera Test Result</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <div className="text-[10px] text-gray-400 font-bold">JB-Score</div>
                    <div className="text-sm font-black">{stats?.jarqueBera.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                    <div className="text-[10px] text-gray-400 font-bold">Std Dev</div>
                    <div className="text-sm font-black">{stats?.stdDev.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeSubTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rankingData.map(perf => (
            <div key={perf.samplerId} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center hover:shadow-md transition">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <UserCheck className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="font-black text-gray-800 mb-1">{perf.samplerId}</h4>
              <p className="text-[10px] text-gray-400 mb-4">تعداد کل نمونه‌ها: {perf.totalSamples}</p>
              <div className="w-full bg-gray-50 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">شاخص اعتبار:</span>
                  <span className={`font-bold ${perf.globalScore > 80 ? 'text-green-600' : 'text-amber-600'}`}>{perf.globalScore.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">وضعیت پایش:</span>
                  <span className={perf.globalScore > 80 ? 'text-green-600' : 'text-amber-600'}>
                    {perf.globalScore > 85 ? 'دقت بالا' : 'قابل قبول'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RankingCard: React.FC<{ rank: number; data: any; color: string; icon: React.ReactNode; badgeColor: string; isWinner?: boolean }> = ({ rank, data, color, icon, badgeColor, isWinner }) => (
  <div className={`relative bg-white p-6 rounded-3xl shadow-xl border-2 transition-all duration-500 hover:translate-y-[-8px] ${color} ${isWinner ? 'scale-110 mb-8 z-10' : 'scale-100'}`}>
    <div className={`absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg ${badgeColor}`}>
      {rank}
    </div>

    <div className="flex flex-col items-center text-center">
      <div className={`mb-4 p-4 rounded-full ${isWinner ? 'bg-yellow-50' : 'bg-gray-50'}`}>
        {icon}
      </div>
      
      <h3 className="text-lg font-black text-gray-800 mb-1">{data?.samplerId || 'نامشخص'}</h3>
      <div className="mb-4">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">امتیاز نهایی</div>
        <div className={`text-3xl font-black ${isWinner ? 'text-yellow-600' : 'text-gray-700'}`}>
          {data?.globalScore ? data.globalScore.toFixed(1) : '0.0'}%
        </div>
      </div>

      <div className="w-full pt-4 border-t border-gray-100 space-y-2">
        <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-500">تعداد نمونه</span>
            <span className="font-bold">{data?.totalSamples || 0}</span>
        </div>
        <div className="flex flex-wrap gap-1 justify-center mt-2">
            {data?.flags && data.flags.length > 0 ? (
                data.flags.map((f: string, i: number) => (
                    <span key={i} className="text-[8px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                        {f}
                    </span>
                ))
            ) : (
                <span className="text-[8px] bg-green-50 text-green-600 px-2 py-0.5 rounded border border-green-100">بدون خطای آماری</span>
            )}
        </div>
      </div>
    </div>
  </div>
);

export default AnalyticsDashboard;
