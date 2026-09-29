import { useState, useEffect } from 'react';

const THEMES = [
  { name: 'Orange Glow', hex: '#f97316', hover: '#ea580c', rgb: '249, 115, 22' },
  { name: 'Neon Blue', hex: '#3b82f6', hover: '#2563eb', rgb: '59, 130, 246' },
  { name: 'Cyber Purple', hex: '#a855f7', hover: '#9333ea', rgb: '168, 85, 247' },
  { name: 'Toxic Green', hex: '#22c55e', hover: '#16a34a', rgb: '34, 197, 94' },
  { name: 'Crimson Red', hex: '#ef4444', hover: '#dc2626', rgb: '239, 68, 68' }
];

export default function Settings() {
  const [activeTheme, setActiveTheme] = useState(THEMES[0].name);

  const applyTheme = (theme: typeof THEMES[0]) => {
    setActiveTheme(theme.name);
    localStorage.setItem('fps-forge-theme', theme.name);
    
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.hex);
    root.style.setProperty('--accent-hover', theme.hover);
    root.style.setProperty('--accent-glow', `rgba(${theme.rgb}, 0.3)`);
    root.style.setProperty('--accent-dim', `rgba(${theme.rgb}, 0.1)`);
  };

  useEffect(() => {
    const saved = localStorage.getItem('fps-forge-theme');
    if (saved) {
      applyTheme(THEMES.find(t => t.name === saved) || THEMES[0]);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-card">
        <h2 style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>🎨</span> Personalization
        </h2>
        
        <div>
          <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            App Accent Theme
          </label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {THEMES.map(theme => (
              <button
                key={theme.name}
                onClick={() => applyTheme(theme)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: theme.hex,
                  border: `4px solid ${activeTheme === theme.name ? 'white' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeTheme === theme.name ? `0 0 20px rgba(${theme.rgb}, 0.6)` : 'none',
                  transform: activeTheme === theme.name ? 'scale(1.1)' : 'scale(1)'
                }}
                title={theme.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>ℹ️</span> About FPS Sens Forge
        </h2>
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <p>
            Welcome to <strong style={{ color: 'var(--text-primary)' }}>FPS Sens Forge V22</strong>. This is a premium, locally hosted application designed to help FPS players perfectly tune, convert, and analyze their mouse sensitivity across all major titles.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <strong>Architecture:</strong> Built from the ground up using React, Vite, and framer-motion, with a custom glassmorphism design system running strictly locally on your machine.
          </p>
          <p style={{ marginTop: '1rem' }}>
            <strong>Mathematical Accuracy:</strong> All conversions use industry-standard Yaw and Multiplier calculations to ensure 100% 360-distance parity.
          </p>
        </div>
      </div>
    </div>
  );
}
