import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, Match, Team, AppView, Game, GamePoint, Session, PlannedMatch } from './types';

interface PickleState {
  view: AppView;
  setView: (v: AppView) => void;

  players: Player[];
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  renamePlayer: (id: string, name: string) => void;

  matches: Match[];
  activeMatchId: string | null;
  startMatch: (teamA: Team, teamB: Team, bestOf: 1 | 3 | 5, sessionId?: string) => string;
  scorePoint: (matchId: string, side: 'A' | 'B') => void;
  undoLastPoint: (matchId: string) => void;
  cancelMatch: (matchId: string) => void;
  deleteMatch: (matchId: string) => void;
  getActiveMatch: () => Match | null;

  sessions: Session[];
  activeSessionId: string | null;
  createSession: (data: Omit<Session, 'id' | 'plannedMatches' | 'createdAt' | 'notificationGranted'>) => void;
  updateSession: (id: string, data: Partial<Omit<Session, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  addPlannedMatch: (sessionId: string, teamA: Team, teamB: Team, bestOf: 1 | 3 | 5) => void;
  removePlannedMatch: (sessionId: string, plannedMatchId: string) => void;
  clearPlannedMatches: (sessionId: string) => void;
  launchPlannedMatch: (sessionId: string, plannedMatchId: string) => void;
  markPlayerAbsent: (sessionId: string, playerId: string, absent: boolean) => void;
  setNotificationGranted: (sessionId: string, granted: boolean) => void;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makePlayer(name: string): Player {
  return { id: makeId(), name, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, gamesPlayed: 0 };
}

function makeGame(): Game {
  return { id: makeId(), teamAScore: 0, teamBScore: 0, points: [] as GamePoint[], winnerId: null, isComplete: false };
}

function checkGameWinner(aScore: number, bScore: number, aId: string, bId: string): string | null {
  if (aScore >= 15 && aScore - bScore >= 2) return aId;
  if (bScore >= 15 && bScore - aScore >= 2) return bId;
  return null;
}

function countWins(games: Game[], teamId: string): number {
  return games.filter((g) => g.winnerId === teamId && g.isComplete).length;
}

export const useStore = create<PickleState>()(
  persist(
    (set, get) => ({
      view: 'players',
      setView: (view) => set({ view }),

      players: [],
      addPlayer: (name) => set((s) => ({ players: [...s.players, makePlayer(name.trim())] })),
      removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.id !== id) })),
      renamePlayer: (id, name) => set((s) => ({ players: s.players.map((p) => p.id === id ? { ...p, name } : p) })),

      matches: [],
      activeMatchId: null,

      startMatch: (teamA, teamB, bestOf, sessionId) => {
        const match: Match = {
          id: makeId(), teamA, teamB,
          games: [makeGame()], currentGameIndex: 0,
          bestOf, winnerId: null, isComplete: false, createdAt: Date.now(),
          sessionId,
        };
        set((s) => ({ matches: [...s.matches, match], activeMatchId: match.id, view: 'match' }));
        return match.id;
      },

      scorePoint: (matchId, side) => {
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId || m.isComplete) return m;
            const games = [...m.games];
            const idx = m.currentGameIndex;
            const game = { ...games[idx] };
            const teamId = side === 'A' ? m.teamA.id : m.teamB.id;
            const newA = game.teamAScore + (side === 'A' ? 1 : 0);
            const newB = game.teamBScore + (side === 'B' ? 1 : 0);
            game.teamAScore = newA;
            game.teamBScore = newB;
            game.points = [...game.points, { scoringTeamId: teamId, pointNumber: game.points.length + 1, timestamp: Date.now() }];
            const gw = checkGameWinner(newA, newB, m.teamA.id, m.teamB.id);
            if (gw) { game.winnerId = gw; game.isComplete = true; }
            games[idx] = game;
            const winsNeeded = Math.ceil(m.bestOf / 2);
            const winsA = countWins(games, m.teamA.id);
            const winsB = countWins(games, m.teamB.id);
            let winnerId: string | null = null;
            let isComplete = false;
            let newIdx = idx;
            if (winsA >= winsNeeded || winsB >= winsNeeded) {
              winnerId = winsA >= winsNeeded ? m.teamA.id : m.teamB.id;
              isComplete = true;
            } else if (game.isComplete) {
              newIdx = idx + 1;
              if (games.length <= newIdx) games.push(makeGame());
            }
            return { ...m, games, currentGameIndex: newIdx, winnerId, isComplete };
          });

          // Update player stats when a match just completed
          let players = s.players;
          const justCompleted = matches.find((m) => m.id === matchId && m.isComplete && !s.matches.find((om) => om.id === matchId)?.isComplete);
          if (justCompleted) {
            const winTeam = justCompleted.winnerId === justCompleted.teamA.id ? justCompleted.teamA : justCompleted.teamB;
            const loseTeam = justCompleted.winnerId === justCompleted.teamA.id ? justCompleted.teamB : justCompleted.teamA;
            const totalA = justCompleted.games.reduce((t, g) => t + g.teamAScore, 0);
            const totalB = justCompleted.games.reduce((t, g) => t + g.teamBScore, 0);
            players = s.players.map((p) => {
              const isW = winTeam.playerIds.includes(p.id);
              const isL = loseTeam.playerIds.includes(p.id);
              if (!isW && !isL) return p;
              const scored = isW ? (justCompleted.winnerId === justCompleted.teamA.id ? totalA : totalB)
                                 : (justCompleted.winnerId === justCompleted.teamA.id ? totalB : totalA);
              const conceded = isW ? (justCompleted.winnerId === justCompleted.teamA.id ? totalB : totalA)
                                   : (justCompleted.winnerId === justCompleted.teamA.id ? totalA : totalB);
              return { ...p, wins: p.wins + (isW ? 1 : 0), losses: p.losses + (isL ? 1 : 0), pointsScored: p.pointsScored + scored, pointsConceded: p.pointsConceded + conceded, gamesPlayed: p.gamesPlayed + 1 };
            });
          }

          return { matches, players };
        });
      },

      undoLastPoint: (matchId) => {
        set((s) => {
          const matches = s.matches.map((m) => {
            if (m.id !== matchId || m.isComplete) return m;
            const games = [...m.games];
            let idx = m.currentGameIndex;
            let game = { ...games[idx] };
            if (game.points.length === 0 && idx > 0) {
              idx--;
              game = { ...games[idx], isComplete: false, winnerId: null };
            }
            if (game.points.length === 0) return m;
            const last = game.points[game.points.length - 1];
            const wasA = last.scoringTeamId === m.teamA.id;
            game = { ...game, teamAScore: game.teamAScore - (wasA ? 1 : 0), teamBScore: game.teamBScore - (wasA ? 0 : 1), points: game.points.slice(0, -1), winnerId: null, isComplete: false };
            games[idx] = game;
            return { ...m, games: games.slice(0, idx + 1), currentGameIndex: idx };
          });
          return { matches };
        });
      },

      cancelMatch: (matchId) => {
        set((s) => {
          const match = s.matches.find((m) => m.id === matchId);
          if (!match || match.isComplete) return s;
          // If this match was launched from a session planned match, reset it
          let sessions = s.sessions;
          if (match.sessionId) {
            sessions = sessions.map((sess) => {
              if (sess.id !== match.sessionId) return sess;
              return {
                ...sess,
                plannedMatches: sess.plannedMatches.map((pm) =>
                  pm.matchId === matchId ? { ...pm, matchId: null } : pm
                ),
              };
            });
          }
          return {
            matches: s.matches.filter((m) => m.id !== matchId),
            activeMatchId: s.activeMatchId === matchId ? null : s.activeMatchId,
            view: (s.activeMatchId === matchId ? 'session' : s.view) as AppView,
            sessions,
          };
        });
      },

      deleteMatch: (matchId) => {
        set((s) => {
          const match = s.matches.find((m) => m.id === matchId);
          if (!match) return s;
          let players = s.players;
          if (match.isComplete && match.winnerId) {
            const winTeam = match.winnerId === match.teamA.id ? match.teamA : match.teamB;
            const loseTeam = match.winnerId === match.teamA.id ? match.teamB : match.teamA;
            const totalA = match.games.reduce((t, g) => t + g.teamAScore, 0);
            const totalB = match.games.reduce((t, g) => t + g.teamBScore, 0);
            players = s.players.map((p) => {
              const isW = winTeam.playerIds.includes(p.id);
              const isL = loseTeam.playerIds.includes(p.id);
              if (!isW && !isL) return p;
              const scored = isW
                ? (match.winnerId === match.teamA.id ? totalA : totalB)
                : (match.winnerId === match.teamA.id ? totalB : totalA);
              const conceded = isW
                ? (match.winnerId === match.teamA.id ? totalB : totalA)
                : (match.winnerId === match.teamA.id ? totalA : totalB);
              return {
                ...p,
                wins: Math.max(0, p.wins - (isW ? 1 : 0)),
                losses: Math.max(0, p.losses - (isL ? 1 : 0)),
                pointsScored: Math.max(0, p.pointsScored - scored),
                pointsConceded: Math.max(0, p.pointsConceded - conceded),
                gamesPlayed: Math.max(0, p.gamesPlayed - 1),
              };
            });
          }
          return {
            matches: s.matches.filter((m) => m.id !== matchId),
            activeMatchId: s.activeMatchId === matchId ? null : s.activeMatchId,
            players,
          };
        });
      },

      getActiveMatch: () => {
        const { matches, activeMatchId } = get();
        return matches.find((m) => m.id === activeMatchId) ?? null;
      },

      // ── Sessions ─────────────────────────────────────────────────
      sessions: [],
      activeSessionId: null,

      createSession: (data) => {
        const session: Session = {
          id: makeId(),
          ...data,
          plannedMatches: [],
          notificationGranted: false,
          createdAt: Date.now(),
        };
        set((s) => ({ sessions: [...s.sessions, session], activeSessionId: session.id, view: 'session' }));
      },

      updateSession: (id, data) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => sess.id === id ? { ...sess, ...data } : sess),
        }));
      },

      deleteSession: (id) => {
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        }));
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      addPlannedMatch: (sessionId, teamA, teamB, bestOf) => {
        const pm: PlannedMatch = { id: makeId(), teamA, teamB, bestOf, matchId: null };
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, plannedMatches: [...sess.plannedMatches, pm] }
              : sess
          ),
        }));
      },

      removePlannedMatch: (sessionId, plannedMatchId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, plannedMatches: sess.plannedMatches.filter((pm) => pm.id !== plannedMatchId) }
              : sess
          ),
        }));
      },

      clearPlannedMatches: (sessionId) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            // Keep any live matches (they have a real matchId that isn't complete yet)
            const liveMatchIds = new Set(s.matches.filter((m) => !m.isComplete).map((m) => m.id));
            return {
              ...sess,
              plannedMatches: sess.plannedMatches.filter((pm) => pm.matchId && liveMatchIds.has(pm.matchId)),
            };
          }),
        }));
      },

      launchPlannedMatch: (sessionId, plannedMatchId) => {
        const { sessions, startMatch } = get();
        const sess = sessions.find((s) => s.id === sessionId);
        if (!sess) return;
        const pm = sess.plannedMatches.find((p) => p.id === plannedMatchId);
        if (!pm || pm.matchId) return;
        const newMatchId = startMatch(pm.teamA, pm.teamB, pm.bestOf, sessionId);
        set((s) => ({
          sessions: s.sessions.map((se) =>
            se.id === sessionId
              ? { ...se, plannedMatches: se.plannedMatches.map((p) => p.id === plannedMatchId ? { ...p, matchId: newMatchId } : p) }
              : se
          ),
        }));
      },

      markPlayerAbsent: (sessionId, playerId, absent) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const absentPlayerIds = absent
              ? [...new Set([...sess.absentPlayerIds, playerId])]
              : sess.absentPlayerIds.filter((id) => id !== playerId);
            return { ...sess, absentPlayerIds };
          }),
        }));
      },

      setNotificationGranted: (sessionId, granted) => {
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, notificationGranted: granted } : sess
          ),
        }));
      },
    }),
    { name: 'pickle-picker-store' }
  )
);
