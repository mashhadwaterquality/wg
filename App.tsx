import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, Map as MapIcon, BarChart2, List, Plus, Database, CloudOff, RefreshCw, Lock, ArrowLeft } from 'lucide-react';
import DataEntryForm from './components/DataEntryForm';
import MapView from './components/MapView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DataList from './components/DataList';
import { WaterSample } from './types';
import { dbService, isDbConfigured } from './utils/database';

type TabType = 'entry' | 'map' | 'analytics' | 'list';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('entry');
  const [samples, setSamples] = useState<WaterSample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Auth state - persisting session authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('isAuth') === 'true';
  });
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabType | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dbService.fetchSamples();
      setSamples(data);
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddSample = async (sample: WaterSample) => {
    setIsSyncing(true);
    try {
      await dbService.saveSample(sample);
      setSamples(prev => [sample, ...prev]);
    } catch (e) {
      alert("خطا در ذخیره‌سازی داده‌ها. لطفاً دوباره تلاش کنید.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    // Restricted access logic
    if ((tab === 'analytics' || tab === 'list') && !isAuthenticated) {
      setPendingTab(tab);
      setShowAuthOverlay(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'abfa.100') {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuth', 'true');
      setShowAuthOverlay(false);
      if (pendingTab) {
        setActiveTab(pendingTab);
        setPendingTab(null);
      }
      setAuthError(false);
      setPassword('');
    } else {
      setAuthError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
                <Droplets className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
                <h1 className="text-xl font-black tracking-wide">AquaGuard</h1>
                <p className="text-xs text-blue-200">سامانه متمرکز پایش کیفی آب</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              className={`p-2 rounded-full hover:bg-blue-800 transition ${isLoading ? 'animate-spin' : ''}`}
              title="به‌روزرسانی"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${isDbConfigured ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-amber-900/30 border-amber-500 text-amber-300'}`}>
               {isDbConfigured ? <Database className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
               {isDbConfigured ? 'دیتابیس متصل' : 'ذخیره محلی'}
            </div>
          </div>
        </div>
      </header>

      {/* Password Modal */}
      {showAuthOverlay && (
        <div className="fixed inset-0 z-[100] bg-blue-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-100 p-4 rounded-full">
                <Lock className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <h2 className="text-xl font-black text-center mb-2 text-gray-800 font-bold">ورود به بخش مدیریت</h2>
            <p className="text-sm text-gray-500 text-center mb-6">برای دسترسی به آمار و سوابق، رمز عبور را وارد کنید.</p>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور"
                  className={`w-full p-4 border rounded-xl text-center text-lg focus:ring-2 outline-none transition ${authError ? 'border-red-500 ring-red-100' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'}`}
                />
                {authError && <p className="text-red-500 text-xs mt-2 text-center font-bold">رمز عبور اشتباه است!</p>}
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition transform active:scale-95"
              >
                تایید و ورود
              </button>
              
              <button
                type="button"
                onClick={() => { setShowAuthOverlay(false); setPendingTab(null); setAuthError(false); }}
                className="w-full text-gray-400 hover:text-gray-600 text-xs font-bold py-2 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> انصراف و بازگشت
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-50/50 z-10 flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
              <span className="text-gray-600 font-bold">در حال دریافت داده‌ها...</span>
            </div>
          </div>
        )}
        
        <div className={isLoading ? 'opacity-30 pointer-events-none' : 'opacity-100 transition-opacity'}>
          {activeTab === 'entry' && <DataEntryForm onSave={handleAddSample} samples={samples} />}
          {activeTab === 'map' && <MapView samples={samples} />}
          {activeTab === 'analytics' && <AnalyticsDashboard samples={samples} />}
          {activeTab === 'list' && <DataList samples={samples} />}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:top-24 md:bottom-auto md:right-4 md:left-auto md:w-44 md:bg-transparent md:border-none md:flex md:flex-col md:gap-4 md:h-screen z-40">
        <div className="flex justify-around items-center p-2 md:hidden">
            <NavBtn active={activeTab === 'entry'} onClick={() => handleTabChange('entry')} icon={<Plus />} label="ثبت" />
            <NavBtn active={activeTab === 'map'} onClick={() => handleTabChange('map')} icon={<MapIcon />} label="نقشه" />
            <NavBtn active={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')} icon={<BarChart2 />} label="آمار" />
            <NavBtn active={activeTab === 'list'} onClick={() => handleTabChange('list')} icon={<List />} label="لیست" />
        </div>
        
        <div className="hidden md:flex flex-col gap-2 bg-white p-2 rounded-2xl shadow-xl border border-gray-100">
            <NavBtnDesktop active={activeTab === 'entry'} onClick={() => handleTabChange('entry')} icon={<Plus />} label="ثبت داده" />
            <NavBtnDesktop active={activeTab === 'map'} onClick={() => handleTabChange('map')} icon={<MapIcon />} label="نقشه" />
            <NavBtnDesktop active={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')} icon={<BarChart2 />} label="تحلیل و آمار" />
            <NavBtnDesktop active={activeTab === 'list'} onClick={() => handleTabChange('list')} icon={<List />} label="سوابق" />
        </div>
      </nav>

      {isSyncing && (
        <div className="fixed bottom-20 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-bounce z-50">
          <Database className="w-4 h-4" />
          <span className="text-sm font-bold">در حال همگام‌سازی...</span>
        </div>
      )}
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition w-16 ${active ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
  >
    {icon}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const NavBtnDesktop: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition w-full text-sm font-bold ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;