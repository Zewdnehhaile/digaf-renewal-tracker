// src/components/FirstRound/FirstRoundSettings.tsx
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { 
  LayoutDashboard, 
  Maximize2, 
  BarChart3,
  Palette,
  Save,
  Monitor
} from 'lucide-react';

interface FirstRoundSettingsProps {
  currentUser: User;
}

export default function FirstRoundSettings({ currentUser }: FirstRoundSettingsProps) {
  const [layout, setLayout] = useState<'split' | 'wide' | 'bento'>('split');
  const [theme, setTheme] = useState<'violet' | 'amethyst' | 'amber'>('violet');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedLayout = localStorage.getItem('digaf_first_round_layout');
    const savedTheme = localStorage.getItem('digaf_first_round_theme');
    if (savedLayout) setLayout(savedLayout as any);
    if (savedTheme) setTheme(savedTheme as any);
  }, []);

  const handleSavePreferences = () => {
    localStorage.setItem('digaf_first_round_layout', layout);
    localStorage.setItem('digaf_first_round_theme', theme);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getThemeColors = () => {
    switch (theme) {
      case 'violet':
        return { primary: '#8B5CF6', primaryLight: '#EDE9FE', primaryDark: '#7C3AED' };
      case 'amethyst':
        return { primary: '#6D28D9', primaryLight: '#EDE9FE', primaryDark: '#5B21B6' };
      case 'amber':
        return { primary: '#F59E0B', primaryLight: '#FEF3C7', primaryDark: '#D97706' };
    }
  };

  const colors = getThemeColors();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#8B5CF6]" />
            Portal Settings
          </h2>
          <p className="text-sm text-slate-500">Customize your workspace layout and theme</p>
        </div>
        <button
          onClick={handleSavePreferences}
          className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>

      {/* Workspace Layout */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[#8B5CF6]" />
          Workspace Layout Studio
        </h3>
        <p className="text-xs text-slate-500 mb-4">Customize column density, focus styles, and visual accents</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Split Dashboard */}
          <button
            onClick={() => setLayout('split')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              layout === 'split' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <LayoutDashboard className={`w-6 h-6 mb-2 ${layout === 'split' ? 'text-[#8B5CF6]' : 'text-slate-400'}`} />
            <h4 className="font-bold text-slate-800 text-sm">Split Dashboard</h4>
            <p className="text-xs text-slate-500 mt-1">Standard layout featuring pipeline workspace, side drawer, and live completions stream.</p>
            <span className="text-[10px] text-[#8B5CF6] font-bold mt-2 inline-block">Best for high-concurrency tasks</span>
          </button>

          {/* Wide Focus Suite */}
          <button
            onClick={() => setLayout('wide')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              layout === 'wide' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <Maximize2 className={`w-6 h-6 mb-2 ${layout === 'wide' ? 'text-[#8B5CF6]' : 'text-slate-400'}`} />
            <h4 className="font-bold text-slate-800 text-sm">Wide Focus Suite</h4>
            <p className="text-xs text-slate-500 mt-1">Collapses secondary panel widgets, giving 100% reading space to critical lists.</p>
            <span className="text-[10px] text-[#8B5CF6] font-bold mt-2 inline-block">Best for data-intensive reviews</span>
          </button>

          {/* Bento Analytics */}
          <button
            onClick={() => setLayout('bento')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              layout === 'bento' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <BarChart3 className={`w-6 h-6 mb-2 ${layout === 'bento' ? 'text-[#8B5CF6]' : 'text-slate-400'}`} />
            <h4 className="font-bold text-slate-800 text-sm">Bento Analytics</h4>
            <p className="text-xs text-slate-500 mt-1">Integrates quick stats directly within an unified executive grid above your table.</p>
            <span className="text-[10px] text-[#8B5CF6] font-bold mt-2 inline-block">Best for high-level monitoring</span>
          </button>
        </div>
      </div>

      {/* Theme Presets */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#8B5CF6]" />
          Select Corporate Accents
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Velvet Violet */}
          <button
            onClick={() => setTheme('violet')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              theme === 'violet' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED]"></div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Velvet Violet</h4>
                <p className="text-xs text-slate-500">DIGAF signature microfinance velvet look</p>
              </div>
            </div>
            <span className="text-[10px] text-[#8B5CF6] font-bold">SELECT ACCENT</span>
          </button>

          {/* Cosmic Amethyst */}
          <button
            onClick={() => setTheme('amethyst')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              theme === 'amethyst' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#4C1D95]"></div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Cosmic Amethyst</h4>
                <p className="text-xs text-slate-500">High-contrast editorial look with vibrant focus indicators</p>
              </div>
            </div>
            <span className="text-[10px] text-[#8B5CF6] font-bold">SELECT ACCENT</span>
          </button>

          {/* Sienna Amber */}
          <button
            onClick={() => setTheme('amber')}
            className={`p-4 border-2 rounded-2xl text-left transition-all ${
              theme === 'amber' ? 'border-[#8B5CF6] bg-violet-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#D97706]"></div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Sienna Amber</h4>
                <p className="text-xs text-slate-500">Warm-hued comfortable preset designed to minimize eye strain</p>
              </div>
            </div>
            <span className="text-[10px] text-[#8B5CF6] font-bold">SELECT ACCENT</span>
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-black text-slate-800 mb-4">Preview</h3>
        <div 
          className="p-4 rounded-xl border-2 border-dashed border-slate-300"
          style={{ borderColor: colors.primary }}
        >
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: colors.primary }}
            >
              D
            </div>
            <div>
              <p className="font-bold text-slate-800" style={{ color: colors.primary }}>
                Digaf Micro Finance
              </p>
              <p className="text-xs text-slate-500">Previewing {theme} theme with {layout} layout</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}