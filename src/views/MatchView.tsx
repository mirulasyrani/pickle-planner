import { useState } from 'react';
import { useStore } from '../store';
import type { Match, Game } from '../types';
import { Undo2, Trophy, ChevronLeft, Plus, XCircle, CalendarDays } from 'lucide-react';

export function MatchView() {
  const { matches, activeMatchId, scorePoint, undoLastPoint, cancelMatch, setView, players, sessions } = useStore();
  const [confirming, setConfirming] = useState(false);
  const match = matches.find((m) => m.id === activeMatchId);

  // Session context
  const parentSession = match?.sessionId ? sessions.find((s) => s.id === match.sessionId) : null;
  const sessionQueue = parentSession
    ? parentSession.plannedMatches.map((pm) => ({
        pm,
        isDone: pm.matchId === 'done' || (pm.matchId ? matches.find((m) => m.id === pm.matchId)?.isComplete : false),
        isActive: pm.matchId === match?.id,
      }))
    : [];

  if (!match) {
    return (
      <div className="view">
        <h2 className="view-title">No Active Match</h2>
        <p className="empty-hint">
          Go to{' '}
          <button className="link-btn" onClick={() => setView('team-picker')}>Team Picker</button>
          {' '}or{' '}
          <button className="link-btn" onClick={() => setView('session')}>Sessions</button>
          {' '}to start one.
        </p>
      </div>
    );
  }

  const currentGame = match.games[match.currentGameIndex];
  const teamAWins = match.games.filter((g) => g.winnerId === match.teamA.id && g.isComplete).length;
  const teamBWins = match.games.filter((g) => g.winnerId === match.teamB.id && g.isComplete).length;

  function getPlayerNames(playerIds: string[]) {
    return playerIds.map((id) => players.find((p) => p.id === id)?.name ?? id).join(' & ');
  }

  return (
    <div className="view match-view">
      {/* Session context strip */}
      {parentSession && (
        <div className="session-context-strip">
          <CalendarDays size={13} />
          <span className="session-context-name">{parentSession.name}</span>
          <div className="session-queue-dots">
            {sessionQueue.map(({ pm, isDone, isActive }) => (
              <span key={pm.id} className={`queue-dot ${isActive ? 'active' : isDone ? 'done' : ''}`} />
            ))}
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: 'auto' }} onClick={() => setView('session')}>
            Session
          </button>
        </div>
      )}

      <div className="match-header">
        <button className="icon-btn" onClick={() => setView(parentSession ? 'session' : 'team-picker')}><ChevronLeft size={18} /></button>
        <div className="match-title-group">
          <h2 className="view-title no-margin">
            {match.teamA.name} <span className="vs-text">vs</span> {match.teamB.name}
          </h2>
          <span className="match-meta">Best of {match.bestOf} · Game {match.currentGameIndex + 1}</span>
        </div>
      </div>

      {match.bestOf > 1 && (
        <div className="series-bar">
          <span className={`series-wins ${teamAWins > teamBWins ? 'leading' : ''}`}>{teamAWins}</span>
          <span className="series-label">Games won</span>
          <span className={`series-wins ${teamBWins > teamAWins ? 'leading' : ''}`}>{teamBWins}</span>
        </div>
      )}

      {match.games.filter((g) => g.isComplete).length > 0 && (
        <div className="prev-games">
          {match.games.filter((g) => g.isComplete).map((g, i) => (
            <div key={g.id} className="prev-game-chip">
              G{i + 1}: {g.teamAScore}-{g.teamBScore}{g.winnerId === match.teamA.id ? ' (A)' : ' (B)'}
            </div>
          ))}
        </div>
      )}

      {match.isComplete ? (
        <MatchComplete match={match} getPlayerNames={getPlayerNames} setView={setView} />
      ) : (
        <>
          <div className="scoreboard">
            <ScorePanel
              teamName={match.teamA.name}
              playerNames={getPlayerNames(match.teamA.playerIds)}
              score={currentGame.teamAScore}
              isLeading={currentGame.teamAScore > currentGame.teamBScore}
              onScore={() => scorePoint(match.id, 'A')}
              color="green"
            />
            <div className="score-divider">
              <div className="score-separator">:</div>
              <div className="serving-hint">First to 11, win by 2</div>
            </div>
            <ScorePanel
              teamName={match.teamB.name}
              playerNames={getPlayerNames(match.teamB.playerIds)}
              score={currentGame.teamBScore}
              isLeading={currentGame.teamBScore > currentGame.teamAScore}
              onScore={() => scorePoint(match.id, 'B')}
              color="blue"
            />
          </div>

          <PointHistory game={currentGame} match={match} />

          <div className="match-controls">
            <button
              className="btn btn-ghost"
              onClick={() => undoLastPoint(match.id)}
              disabled={currentGame.points.length === 0 && match.currentGameIndex === 0}
            >
              <Undo2 size={16} /> Undo
            </button>
            {confirming ? (
              <>
                <span className="cancel-confirm-text">Cancel match?</span>
                <button className="btn btn-danger" onClick={() => cancelMatch(match.id)}>Yes, cancel</button>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>No</button>
              </>
            ) : (
              <button className="btn btn-ghost btn-danger-outline" onClick={() => setConfirming(true)}>
                <XCircle size={15} /> Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScorePanel({ teamName, playerNames, score, isLeading, onScore, color }: {
  teamName: string; playerNames: string; score: number; isLeading: boolean;
  onScore: () => void; color: 'green' | 'blue';
}) {
  return (
    <div className={`score-panel ${color} ${isLeading ? 'leading' : ''}`}>
      <div className="score-team-name">{teamName}</div>
      <div className="score-player-names">{playerNames}</div>
      <div className="score-number">{score}</div>
      <button className={`score-btn ${color}`} onClick={onScore} aria-label={`Score for ${teamName}`}>
        <Plus size={22} /> Point
      </button>
    </div>
  );
}

function PointHistory({ game, match }: { game: Game; match: Match }) {
  if (game.points.length === 0) return null;
  const recent = [...game.points].reverse().slice(0, 8);
  return (
    <div className="point-history">
      <h3 className="point-history-title">Recent Points</h3>
      <div className="point-history-list">
        {recent.map((pt, i) => {
          const isA = pt.scoringTeamId === match.teamA.id;
          return (
            <div key={i} className={`point-entry ${isA ? 'green' : 'blue'}`}>
              <span className="point-num">#{game.points.length - i}</span>
              <span className="point-team">{isA ? match.teamA.name : match.teamB.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchComplete({ match, getPlayerNames, setView }: {
  match: Match;
  getPlayerNames: (ids: string[]) => string;
  setView: (v: import('../types').AppView) => void;
}) {
  const winner = match.winnerId === match.teamA.id ? match.teamA : match.teamB;
  const totalA = match.games.reduce((s, g) => s + g.teamAScore, 0);
  const totalB = match.games.reduce((s, g) => s + g.teamBScore, 0);
  const winsA = match.games.filter((g) => g.winnerId === match.teamA.id).length;
  const winsB = match.games.filter((g) => g.winnerId === match.teamB.id).length;

  return (
    <div className="match-complete">
      <div className="trophy-icon"><Trophy size={48} /></div>
      <h2 className="winner-title">{winner.name} wins!</h2>
      <p className="winner-players">{getPlayerNames(winner.playerIds)}</p>

      <div className="final-score-grid">
        <div className="final-team green">
          <div className="final-team-name">{match.teamA.name}</div>
          <div className="final-score-big">{match.bestOf > 1 ? winsA : totalA}</div>
          <div className="final-label">{match.bestOf > 1 ? 'games' : 'points'}</div>
        </div>
        <div className="final-vs">vs</div>
        <div className="final-team blue">
          <div className="final-team-name">{match.teamB.name}</div>
          <div className="final-score-big">{match.bestOf > 1 ? winsB : totalB}</div>
          <div className="final-label">{match.bestOf > 1 ? 'games' : 'points'}</div>
        </div>
      </div>

      <div className="games-breakdown">
        {match.games.filter((g) => g.isComplete).map((g, i) => (
          <div key={g.id} className="breakdown-row">
            <span>Game {i + 1}</span>
            <span className={g.winnerId === match.teamA.id ? 'green-text bold' : ''}>{g.teamAScore}</span>
            <span>-</span>
            <span className={g.winnerId === match.teamB.id ? 'blue-text bold' : ''}>{g.teamBScore}</span>
          </div>
        ))}
      </div>

      <div className="match-end-actions">
        {match.sessionId ? (
          <button className="btn btn-primary" onClick={() => setView('session')}>
            <CalendarDays size={15} /> Back to Session
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setView('team-picker')}>New Match</button>
        )}
        <button className="btn btn-ghost" onClick={() => setView('stats')}>View Stats</button>
      </div>
    </div>
  );
}
