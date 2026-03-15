import type { Team } from '../types';

type PlayerLike = { id: string; name: string };

export function makeId() { return Math.random().toString(36).slice(2, 10); }

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ScheduledFixture {
  id: string;
  teamA: Team;
  teamB: Team;
  bestOf: 1 | 3 | 5;
}

/**
 * Generates a social round-robin schedule from a player pool.
 * Each pair of players appears as teammates at most twice across all fixtures.
 */
export function buildSocialRoundRobin(
  pool: PlayerLike[],
  teamSize: number,
  bestOf: 1 | 3 | 5,
): ScheduledFixture[] {
  if (pool.length < teamSize * 2) return [];

  const ids = pool.map((p) => p.id);

  function combos(arr: string[], k: number): string[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [head, ...tail] = arr;
    return [...combos(tail, k - 1).map((c) => [head, ...c]), ...combos(tail, k)];
  }

  const allTeams = combos(ids, teamSize);
  const allMatches: [string[], string[]][] = [];
  for (let i = 0; i < allTeams.length; i++) {
    const tA = allTeams[i];
    for (let j = i + 1; j < allTeams.length; j++) {
      const tB = allTeams[j];
      if (!tA.some((id) => tB.includes(id))) allMatches.push([tA, tB]);
    }
  }
  const shuffled = shuffle(allMatches);

  const pairUsed = new Map<string, number>();
  const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  function pairKeys(team: string[]) {
    const keys: string[] = [];
    for (let i = 0; i < team.length; i++)
      for (let j = i + 1; j < team.length; j++)
        keys.push(pk(team[i], team[j]));
    return keys;
  }
  function canUse(team: string[]) {
    return pairKeys(team).every((k) => (pairUsed.get(k) ?? 0) < 2);
  }

  const fixtures: ScheduledFixture[] = [];
  for (const [tA, tB] of shuffled) {
    if (canUse(tA) && canUse(tB)) {
      pairKeys(tA).forEach((k) => pairUsed.set(k, (pairUsed.get(k) ?? 0) + 1));
      pairKeys(tB).forEach((k) => pairUsed.set(k, (pairUsed.get(k) ?? 0) + 1));
      const nameOf = (id: string) => pool.find((p) => p.id === id)!.name;
      fixtures.push({
        id: makeId(),
        teamA: { id: makeId(), name: tA.map(nameOf).join(' & '), playerIds: tA },
        teamB: { id: makeId(), name: tB.map(nameOf).join(' & '), playerIds: tB },
        bestOf,
      });
    }
  }
  return fixtures;
}

/**
 * Estimate how many social round-robin fixtures will be generated for N players.
 * (Useful for showing a count preview without running the full algorithm.)
 */
export function estimateFixtureCount(playerCount: number, teamSize: number): number {
  const n = playerCount;
  if (n < teamSize * 2) return 0;
  if (teamSize === 1) return (n * (n - 1)) / 2;
  // Each fixture uses C(teamSize,2) pair-slots per side; budget is C(n,2)*2
  return Math.floor((n * (n - 1)) / (teamSize * (teamSize - 1)));
}
