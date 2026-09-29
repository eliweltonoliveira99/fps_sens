export interface Game {
  id: string;
  name: string;
  short: string;
  yaw: number;
  isR6: boolean;
  color: string;
}

export const GAMES: Game[] = [
  { id: 'cs2', name: 'CS2 / CS:GO', short: 'CS2', yaw: 0.022, isR6: false, color: '#38bdf8' },
  { id: 'valorant', name: 'Valorant', short: 'Valorant', yaw: 0.07, isR6: false, color: '#f87171' },
  { id: 'r6', name: 'Rainbow Six Siege', short: 'R6', yaw: 0.00573, isR6: true, color: '#ff8c00' },
  { id: 'apex', name: 'Apex Legends', short: 'Apex', yaw: 0.022, isR6: false, color: '#ef4444' },
  { id: 'ow2', name: 'Overwatch 2', short: 'OW2', yaw: 0.0066, isR6: false, color: '#f97316' },
  { id: 'wz', name: 'CoD: Warzone', short: 'Warzone', yaw: 0.0066, isR6: false, color: '#84cc16' },
  { id: 'fn', name: 'Fortnite', short: 'Fortnite', yaw: 0.05555, isR6: false, color: '#a78bfa' },
  { id: 'pubg', name: 'PUBG', short: 'PUBG', yaw: 0.002222, isR6: false, color: '#fbbf24' },
  { id: 'rust', name: 'Rust', short: 'Rust', yaw: 0.00222, isR6: false, color: '#78716c' },
  { id: 'finals', name: 'The Finals', short: 'Finals', yaw: 0.02, isR6: false, color: '#22d3ee' },
  { id: 'marvel', name: 'Marvel Rivals', short: 'Marvel', yaw: 0.0066, isR6: false, color: '#ec4899' },
  { id: 'fp', name: 'FragPunk', short: 'FragPunk', yaw: 0.0556, isR6: false, color: '#10b981' },
  { id: 'tarkov', name: 'Escape From Tarkov', short: 'Tarkov', yaw: 0.125, isR6: false, color: '#6b7280' },
  { id: 'halo', name: 'Halo Infinite', short: 'Halo', yaw: 0.022, isR6: false, color: '#60a5fa' },
  { id: 'dl', name: 'Deadlock', short: 'Deadlock', yaw: 0.022, isR6: false, color: '#c084fc' },
  { id: 'df', name: 'Delta Force', short: 'Delta Force', yaw: 0.022, isR6: false, color: '#059669' },
  { id: 'xd', name: 'XDefiant', short: 'XDefiant', yaw: 0.022, isR6: false, color: '#f472b6' },
  { id: 'sd', name: 'Spectre Divide', short: 'Spectre', yaw: 0.07, isR6: false, color: '#06b6d4' },
];
