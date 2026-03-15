export interface Player {
  id: string;
  name: string;
  wins: number;
  losses: number;
  pointsScored: number;
  pointsConceded: number;
  gamesPlayed: number;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface GamePoint {
  scoringTeamId: string;
  pointNumber: number;
  timestamp: number;
}

export interface Game {
  id: string;
  teamAScore: number;
  teamBScore: number;
  points: GamePoint[];
  winnerId: string | null;
  isComplete: boolean;
}

export interface Match {
  id: string;
  teamA: Team;
  teamB: Team;
  games: Game[];
  currentGameIndex: number;
  bestOf: number;
  winnerId: string | null;
  isComplete: boolean;
  createdAt: number;
  /** The session this match belongs to, if any */
  sessionId?: string;
}

/** A scheduled pairing inside a session (planned, not yet started) */
export interface PlannedMatch {
  id: string;
  teamA: Team;
  teamB: Team;
  bestOf: 1 | 3 | 5;
  /** null = not started | string = live match id | 'done' = completed */
  matchId: string | null;
}

/** A session is a scheduled event with location/time, confirmed players, and a queue of matches */
export interface Session {
  id: string;
  name: string;
  location: string;
  date: string;       // ISO date string YYYY-MM-DD
  time: string;       // HH:MM
  endTime?: string;
  format?: 'singles' | 'doubles';
  confirmedPlayerIds: string[];
  absentPlayerIds: string[];
  plannedMatches: PlannedMatch[];
  bestOf: 1 | 3 | 5; // default for new planned matches
  alertEnabled: boolean;
  alertMinutesBefore: number;
  /** browser Notification permission was granted */
  notificationGranted: boolean;
  createdAt: number;
}

export type AppView = 'players' | 'team-picker' | 'match' | 'stats' | 'session';
