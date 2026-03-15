import { useStore } from '../store';
import { Trophy, TrendingUp, Target, Swords, Trash2 } from 'lucide-react';

export function StatsView() {
  const { players, matches, deleteMatch } = useStore();

  const sorted = [...players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.pointsScored - b.pointsConceded) - (a.pointsScored - a.pointsConceded);
  });

  const completedMatches = matches.filter((m) => m.isComplete);

  return (
    <div className="view">
      <h2 className="view-title">Stats & Leaderboard</h2>

      {players.length === 0 ? (
        <p className="empty-hint">No players yet.</p>
      ) : (
        <>
          <div className="leaderboard">
            {sorted.map((p, idx) => {
              const winRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
              const diff = p.pointsScored - p.pointsConceded;
              return (
                <div key={p.id} className={`lb-row ${idx === 0 && p.gamesPlayed > 0 ? 'first-place' : ''}`}>
                  <div className="lb-rank">{idx === 0 && p.gamesPlayed > 0 ? <Trophy size={18} /> : `#${idx + 1}`}</div>
                  <div className="lb-avatar">{p.name[0].toUpperCase()}</div>
                  <div className="lb-info">
                    <div className="lb-name">{p.name}</div>
                    <div className="lb-sub">{p.gamesPlayed} match{p.gamesPlayed !== 1 ? 'es' : ''} played</div>
                  </div>
                  <div className="lb-stats">
                    <StatBubble icon={<Swords size={12} />} label="W/L" value={`${p.wins}/${p.losses}`} />
                    <StatBubble icon={<TrendingUp size={12} />} label="Win%" value={`${winRate}%`} />
                    <StatBubble icon={<Target size={12} />} label="+/-" value={diff >= 0 ? `+${diff}` : `${diff}`} positive={diff >= 0} />
                  </div>
                </div>
              );
            })}
          </div>

          {completedMatches.length > 0 && (
            <div className="match-history">
              <h3 className="section-title">Match History</h3>
              {[...completedMatches].reverse().map((m) => {
                const winner = m.winnerId === m.teamA.id ? m.teamA : m.teamB;
                const totalA = m.games.reduce((s, g) => s + g.teamAScore, 0);
                const totalB = m.games.reduce((s, g) => s + g.teamBScore, 0);
                const winsA = m.games.filter((g) => g.winnerId === m.teamA.id).length;
                const winsB = m.games.filter((g) => g.winnerId === m.teamB.id).length;
                const date = new Date(m.createdAt).toLocaleDateString();
                return (
                  <div key={m.id} className="history-row">
                    <div className="history-row-top">
                      <div className="history-date">{date}</div>
                      <button className="icon-btn red icon-btn-sm" onClick={() => deleteMatch(m.id)} title="Remove match">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="history-teams">
                      <span className={m.winnerId === m.teamA.id ? 'winner-name' : ''}>{m.teamA.name}</span>
                      <span className="history-score">
                        {m.bestOf > 1 ? `${winsA}-${winsB} (${totalA}-${totalB} pts)` : `${totalA}-${totalB}`}
                      </span>
                      <span className={m.winnerId === m.teamB.id ? 'winner-name' : ''}>{m.teamB.name}</span>
                    </div>
                    <div className="history-winner">🏆 {winner.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatBubble({ icon, label, value, positive }: {
  icon: React.ReactNode; label: string; value: string; positive?: boolean;
}) {
  return (
    <div className={`stat-bubble ${positive === false ? 'negative' : ''}`}>
      {icon}
      <span className="stat-bubble-label">{label}</span>
      <span className="stat-bubble-value">{value}</span>
    </div>
  );
}
