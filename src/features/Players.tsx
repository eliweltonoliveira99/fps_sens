import { useState, useMemo } from 'react';
import { PLAYERS } from '../data/players';
import { GAMES } from '../data/games';
import { calcCm } from '../utils';

export default function Players() {
  const [search, setSearch] = useState('');
  const [gameFilter, setGameFilter] = useState('all');

  const filtered = useMemo(() => {
    return PLAYERS.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase());
      const matchGame = gameFilter === 'all' || p.game === gameFilter;
      return matchSearch && matchGame;
    });
  }, [search, gameFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header and Filters */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>Pro Players Database</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Showing {filtered.length} of {PLAYERS.length} players</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <input 
            type="text" 
            placeholder="Search player or team..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
          <select value={gameFilter} onChange={e => setGameFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All Games</option>
            {GAMES.slice(0, 8).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Players Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {filtered.map((p, i) => {
          const g = GAMES.find(x => x.id === p.game);
          const cm = p.cm360 != null ? p.cm360 : calcCm(g?.yaw || 0, p.sensH || 1, p.dpi, p.multiplier || 0.02, g?.isR6 || false);
          
          return (
            <div key={i} className="glass-card" style={{ 
              padding: '1.25rem', 
              borderLeft: `4px solid ${g?.color || 'var(--accent)'}`,
              display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{p.name}</h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.team}</div>
                </div>
                <div style={{ 
                  background: 'var(--surface-3)', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: g?.color
                }}>
                  {g?.short}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DPI</div>
                  <div className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.dpi}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sens</div>
                  <div className="mono" style={{ color: 'var(--text-primary)' }}>{p.sensH || p.sensV || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Role</div>
                  <div style={{ fontSize: '0.85rem' }}>{p.role || 'Player'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>cm/360°</div>
                  <div className="mono" style={{ color: 'var(--text-primary)' }}>{cm.toFixed(1)}</div>
                </div>
              </div>
              
              {p.note && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  "{p.note}"
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {filtered.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>No players found</h3>
        </div>
      )}
    </div>
  );
}
