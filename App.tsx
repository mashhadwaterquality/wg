import React, { useState, useEffect } from 'react';
import { Droplets, Map as MapIcon, BarChart2, List, Plus } from 'lucide-react';
import DataEntryForm from './components/DataEntryForm';
import MapView from './components/MapView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DataList from './components/DataList';
import { WaterSample } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entry' | 'map' | 'analytics' | 'list'>('entry');
  const [samples, setSamples] = useState<WaterSample[]>([]);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aquaguard_data');
    if (saved) {
      try {
        setSamples(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse local data", e);
      }
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('aquaguard_data', JSON.stringify(samples));
  }, [samples]);

  const handleAddSample = (sample: WaterSample) => {
    setSamples(prev => [...prev, sample]);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
                <Droplets className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
                <h1 className="text-xl font-black tracking-wide">AquaGuard</h1>
                <p className="text-xs text-blue-200">سامانه پایش کیفی آب</p>
            </div>
          </div>
          <div className="text-xs bg-blue-800 px-3 py-1 rounded-full border border-blue-700">
             {samples.length} نمونه ثبت شده
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {activeTab === 'entry' && <DataEntryForm onSave={handleAddSample} />}
        {activeTab === 'map' && <MapView samples={samples} />}
        {activeTab === 'analytics' && <AnalyticsDashboard samples={samples} />}
        {activeTab === 'list' && <DataList samples={samples} />}
      </main>

      {/* Mobile/Desktop Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:top-20 md:bottom-auto md:right-4 md:left-auto md:w-20 md:bg-transparent md:border-none md:flex md:flex-col md:gap-4 md:h-screen z-40">
        
        {/* Mobile Tab Bar */}
        <div className="flex justify-around items-center p-2 md:hidden">
            <NavBtn active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={<Plus />} label="ثبت" />
            <NavBtn active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon />} label="نقشه" />
            <NavBtn active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<BarChart2 />} label="آمار" />
            <NavBtn active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} label="لیست" />
        </div>

      </nav>
      
      {/* Desktop Sidebar (Visual only, logic shared) */}
      <div className="hidden md:flex fixed top-24 left-4 flex-col gap-2 z-40">
        <div className="bg-white p-2 rounded-xl shadow-lg border border-gray-100 flex flex-col gap-2">
            <NavBtnDesktop active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={<Plus />} label="ثبت داده" />
            <NavBtnDesktop active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon />} label="نقشه" />
            <NavBtnDesktop active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<BarChart2 />} label="تحلیل" />
            <NavBtnDesktop active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} label="سوابق" />
        </div>
      </div>

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
    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition w-40 text-sm font-bold ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;
