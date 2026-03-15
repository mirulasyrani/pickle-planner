import { useStore } from './store';
import { PlayersView } from './views/PlayersView';
import { TeamPickerView } from './views/TeamPickerView';
import { MatchView } from './views/MatchView';
import { StatsView } from './views/StatsView';
import { SessionView } from './views/SessionView';
import { Users, Shuffle, Swords, BarChart2, CalendarDays } from 'lucide-react';
import type { AppView } from './types';

const NAV_ITEMS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  { id: 'players', label: 'Players', icon: <Users size={20} /> },
  { id: 'session', label: 'Sessions', icon: <CalendarDays size={20} /> },
  { id: 'team-picker', label: 'Pick', icon: <Shuffle size={20} /> },
  { id: 'match', label: 'Match', icon: <Swords size={20} /> },
  { id: 'stats', label: 'Stats', icon: <BarChart2 size={20} /> },
];

export function App() {
  const { view, setView, activeMatchId, matches, sessions } = useStore();
  const activeMatch = matches.find((m) => m.id === activeMatchId);
  const hasActiveMatch = activeMatch && !activeMatch.isComplete;
  const upcomingSessions = sessions.filter((s) => s.date && new Date(`${s.date}T${s.time || '00:00'}`).getTime() > Date.now());

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-pickle">🥒</span>
          <span className="logo-text">Pickle Picker</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {upcomingSessions.length > 0 && (
            <div className="session-badge" onClick={() => setView('session')}>
              <CalendarDays size={11} /> {upcomingSessions.length} upcoming
            </div>
          )}
          {hasActiveMatch && (
            <div className="live-badge" onClick={() => setView('match')}>LIVE</div>
          )}
        </div>
      </header>

      <main className="app-main">
        {view === 'players' && <PlayersView />}
        {view === 'session' && <SessionView />}
        {view === 'team-picker' && <TeamPickerView />}
        {view === 'match' && <MatchView />}
        {view === 'stats' && <StatsView />}
      </main>

      <nav className="app-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
            {item.id === 'match' && hasActiveMatch && <span className="nav-dot" />}
            {item.id === 'session' && upcomingSessions.length > 0 && <span className="nav-dot" style={{ background: 'var(--yellow)', boxShadow: '0 0 6px rgba(251,191,36,0.6)' }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}
