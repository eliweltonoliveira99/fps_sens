import { useState } from 'react';
import { Crosshair, Users, Activity, Settings as SettingsIcon, AlignJustify } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Converter from './features/Converter';
import Stats from './features/Stats';
import Players from './features/Players';
import SensFinder from './features/SensFinder';
import Settings from './features/Settings';

function App() {
  const [activeTab, setActiveTab] = useState('converter');

  // Load theme on mount globally
  useState(() => {
    const saved = localStorage.getItem('fps-forge-theme');
    if (saved) {
      const themes: Record<string, any> = {
        'Neon Blue': { hex: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
        'Cyber Purple': { hex: '#a855f7', hover: '#9333ea', rgb: '168, 85, 247' },
        'Toxic Green': { hex: '#22c55e', hover: '#16a34a', rgb: '34, 197, 94' },
        'Crimson Red': { hex: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' }
      };
      const t = themes[saved];
      if (t) {
        const root = document.documentElement;
        root.style.setProperty('--accent', t.hex);
        root.style.setProperty('--accent-hover', t.hover);
        root.style.setProperty('--accent-glow', `rgba(${t.rgb}, 0.3)`);
        root.style.setProperty('--accent-dim', `rgba(${t.rgb}, 0.1)`);
      }
    }
  });

  const tabs = [
    { id: 'converter', label: 'Converter', icon: Crosshair },
    { id: 'players', label: 'Pro Players', icon: Users },
    { id: 'stats', label: 'Statistics', icon: Activity },
    { id: 'finder', label: 'Sens Finder', icon: AlignJustify },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{ 
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', 
            width: '48px', height: '48px', borderRadius: '12px',
            display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-glow)'
          }}>
            <Crosshair color="white" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0 }} className="text-gradient">FPS Sens Forge</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Universal Sensitivity Converter & Analyzer</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ background: 'var(--surface-2)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}
        >
          <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>v22.0.0</span>
        </motion.div>
      </header>

      {/* Tabs */}
      <nav style={{ 
        display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', 
        paddingBottom: '0.5rem', scrollbarWidth: 'none'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                background: isActive ? 'var(--surface-3)' : 'var(--surface-1)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--border-hover)' : 'var(--border)'}`,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                position: 'relative'
              }}
            >
              <Icon size={18} color={isActive ? 'var(--accent)' : 'currentColor'} />
              <span style={{ fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  style={{
                    position: 'absolute', bottom: -1, left: '10%', right: '10%',
                    height: 2, background: 'var(--accent)', borderRadius: '2px',
                    boxShadow: '0 -2px 10px var(--accent-glow)'
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main style={{ minHeight: '60vh' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'converter' && (
              <Converter />
            )}
            
            {activeTab === 'players' && (
              <Players />
            )}

            {activeTab === 'stats' && (
              <Stats />
            )}

            {activeTab === 'finder' && (
              <SensFinder />
            )}

            {activeTab === 'settings' && (
              <Settings />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
