import { useState, useCallback } from 'react';
import { useStore } from '../store';
import type { Player, Team } from '../types';
import { Shuffle, Users, ChevronRight, RotateCcw, List, Trash2, Play, RefreshCw } from 'lucide-react';

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Mode = 'random' | 'manual' | 'bulk';

interface FixturePreview {
  id: string;
  teamA: Team;
  teamB: Team;
  bestOf: 1 | 3 | 5;
}

function buildSocialRoundRobin(pool: Player[], teamSize: number, bestOf: 1 | 3 | 5): FixturePreview[] {
  if (pool.length < teamSize * 2) return [];

  const ids = pool.map((p) => p.id);

  // All k-combinations of an array
  function combos(arr: string[], k: number): string[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [head, ...tail] = arr;
    return [...combos(tail, k - 1).map((c) => [head, ...c]), ...combos(tail, k)];
  }

  // Every possible team of size teamSize
  const allTeams = combos(ids, teamSize);

  // Every match: two non-overlapping teams, shuffled for variety
  const allMatches: [string[], string[]][] = [];
  for (let i = 0; i < allTeams.length; i++) {
    const tA = allTeams[i];
    for (let j = i + 1; j < allTeams.length; j++) {
      const tB = allTeams[j];
      if (!tA.some((id) => tB.includes(id))) allMatches.push([tA, tB]);
    }
  }
  const shuffled = shuffle(allMatches);

  // Greedy pick: each teammate pair used at most twice
  const pairUsed = new Map<string, number>();
  const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  function pairKeys(team: string[]): string[] {
    const keys: string[] = [];
    for (let i = 0; i < team.length; i++)
      for (let j = i + 1; j < team.length; j++)
        keys.push(pk(team[i], team[j]));
    return keys;
  }
  function canUse(team: string[]) {
    return pairKeys(team).every((k) => (pairUsed.get(k) ?? 0) < 2);
  }

  const fixtures: FixturePreview[] = [];
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

function buildRandom(pool: Player[], teamSize: number, bestOf: 1 | 3 | 5, count: number): FixturePreview[] {
  if (pool.length < teamSize * 2) return [];
  return Array.from({ length: count }, () => {
    const s = shuffle(pool);
    return {
      id: makeId(),
      teamA: { id: makeId(), name: 'Team A', playerIds: s.slice(0, teamSize).map((p) => p.id) },
      teamB: { id: makeId(), name: 'Team B', playerIds: s.slice(teamSize, teamSize * 2).map((p) => p.id) },
      bestOf,
    };
  });
}

export function TeamPickerView() {
  const { players, sessions, activeSessionId, startMatch, addPlannedMatch, setView } = useStore();
  const [mode, setMode] = useState<Mode>('random');
  const teamSize = 2;
  const bestOf: 1 | 3 | 5 = 1;

  // ── Random mode ──
  const [randomTeams, setRandomTeams] = useState<Team[]>([]);
  const [pickedA, setPickedA] = useState<string | null>(null);
  const [pickedB, setPickedB] = useState<string | null>(null);

  // ── Manual mode ──
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamBName, setTeamBName] = useState('Team B');

  // ── Bulk mode ──
  const [bulkPoolIds, setBulkPoolIds] = useState<string[]>(() => players.map((p) => p.id));
  const [bulkStrategy, setBulkStrategy] = useState<'round-robin' | 'random'>('round-robin');
  const [bulkCount, setBulkCount] = useState(3);
  const [fixtures, setFixtures] = useState<FixturePreview[]>([]);
  const [targetSessionId, setTargetSessionId] = useState<string>(() => activeSessionId ?? '');
  const [addedCount, setAddedCount] = useState<number | null>(null);

  const handleRandomise = useCallback(() => {
    if (players.length < teamSize * 2) return;
    const shuffled = shuffle(players);
    const teamCount = Math.floor(shuffled.length / teamSize);
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: makeId(),
      name: `Team ${i + 1}`,
      playerIds: shuffled.slice(i * teamSize, (i + 1) * teamSize).map((p) => p.id),
    }));
    setRandomTeams(teams);
    setPickedA(teams[0]?.id ?? null);
    setPickedB(teams[1]?.id ?? null);
  }, [players, teamSize]);

  function getPlayerById(id: string): Player | undefined {
    return players.find((p) => p.id === id);
  }

  function toggleManual(playerId: string, side: 'A' | 'B') {
    if (side === 'A') {
      if (teamAIds.includes(playerId)) {
        setTeamAIds(teamAIds.filter((id) => id !== playerId));
      } else if (teamAIds.length < teamSize) {
        setTeamAIds([...teamAIds, playerId]);
        setTeamBIds(teamBIds.filter((id) => id !== playerId));
      }
    } else {
      if (teamBIds.includes(playerId)) {
        setTeamBIds(teamBIds.filter((id) => id !== playerId));
      } else if (teamBIds.length < teamSize) {
        setTeamBIds([...teamBIds, playerId]);
        setTeamAIds(teamAIds.filter((id) => id !== playerId));
      }
    }
  }

  function handleStartRandom() {
    const tA = randomTeams.find((t) => t.id === pickedA);
    const tB = randomTeams.find((t) => t.id === pickedB);
    if (!tA || !tB) return;
    startMatch(tA, tB, bestOf);
  }

  function handleStartManual() {
    if (teamAIds.length === 0 || teamBIds.length === 0) return;
    const tA: Team = { id: makeId(), name: teamAName.trim() || 'Team A', playerIds: teamAIds };
    const tB: Team = { id: makeId(), name: teamBName.trim() || 'Team B', playerIds: teamBIds };
    startMatch(tA, tB, bestOf);
  }

  function resetManual() {
    setTeamAIds([]);
    setTeamBIds([]);
  }

  // ── Bulk helpers ──
  const bulkPool = players.filter((p) => bulkPoolIds.includes(p.id));

  function toggleBulkPlayer(id: string) {
    setBulkPoolIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setFixtures([]);
  }

  const rrMatchCount = (() => {
    const n = bulkPool.length;
    if (n < teamSize * 2) return 0;
    // For 2v2: each match uses 1 unique pair, so C(n,2) total pairs = n*(n-1)/2
    return Math.floor((n * (n - 1)) / (teamSize * (teamSize - 1)));
  })();

  function handleGenerate() {
    if (bulkPool.length < teamSize * 2) return;
    const generated = bulkStrategy === 'round-robin'
      ? buildSocialRoundRobin(bulkPool, teamSize, bestOf)
      : buildRandom(bulkPool, teamSize, bestOf, bulkCount);
    setFixtures(generated);
    setAddedCount(null);
  }

  function rerollFixture(fixtureId: string) {
    if (bulkPool.length < teamSize * 2) return;
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== fixtureId) return f;
        const s = shuffle(bulkPool);
        const tA = s.slice(0, teamSize);
        const tB = s.slice(teamSize, teamSize * 2);
        return {
          ...f,
          teamA: { id: makeId(), name: tA.map((p) => p.name).join(' & '), playerIds: tA.map((p) => p.id) },
          teamB: { id: makeId(), name: tB.map((p) => p.name).join(' & '), playerIds: tB.map((p) => p.id) },
        };
      })
    );
  }

  function removeFixture(fixtureId: string) {
    setFixtures((prev) => prev.filter((f) => f.id !== fixtureId));
  }

  function handleAddAllToSession() {
    if (!targetSessionId || fixtures.length === 0) return;
    fixtures.forEach((f) => addPlannedMatch(targetSessionId, f.teamA, f.teamB, f.bestOf));
    setAddedCount(fixtures.length);
    setFixtures([]);
    setTimeout(() => setAddedCount(null), 3000);
  }

  function handleStartFirstQueueRest() {
    if (fixtures.length === 0) return;
    const [first, ...rest] = fixtures;
    const sid = targetSessionId || undefined;
    if (sid && rest.length > 0) {
      rest.forEach((f) => addPlannedMatch(sid, f.teamA, f.teamB, f.bestOf));
    }
    startMatch(first.teamA, first.teamB, first.bestOf, sid);
    setFixtures([]);
  }

  if (players.length < 2) {
    return (
      <div className="view">
        <h2 className="view-title">Team Picker</h2>
        <p className="empty-hint">
          You need at least 2 players. Go add some in the{' '}
          <button className="link-btn" onClick={() => setView('players')}>Players</button> tab.
        </p>
      </div>
    );
  }

  const canStartManual = teamAIds.length > 0 && teamBIds.length > 0;

  return (
    <div className="view">
      <h2 className="view-title">Team Picker</h2>

      <div className="picker-settings">
        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'random' ? 'active' : ''}`} onClick={() => setMode('random')}>
            <Shuffle size={14} /> Random
          </button>
          <button className={`toggle-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>
            <Users size={14} /> Manual
          </button>
          <button className={`toggle-btn ${mode === 'bulk' ? 'active' : ''}`}
            onClick={() => { setMode('bulk'); setBulkPoolIds(players.map((p) => p.id)); }}>
            <List size={14} /> Bulk
          </button>
        </div>

      </div>

      {/* ── Random mode ── */}
      {mode === 'random' && (
        <div className="random-section">
          {players.length < teamSize * 2 ? (
            <p className="empty-hint">Need at least {teamSize * 2} players for {teamSize}v{teamSize}.</p>
          ) : (
            <>
              <button className="btn btn-primary big-btn" onClick={handleRandomise}>
                <Shuffle size={18} />
                {randomTeams.length > 0 ? 'Re-randomise' : 'Randomise Teams'}
              </button>

              {randomTeams.length > 0 && (
                <>
                  {/* Sitting-out notice */}
                  {players.length % teamSize !== 0 && (
                    <p className="empty-hint" style={{ fontSize: '0.8rem', marginTop: 0 }}>
                      {players.length % teamSize} player{players.length % teamSize !== 1 ? 's' : ''} sitting out (not divisible by {teamSize})
                    </p>
                  )}

                  {/* All teams – tap to select A / B */}
                  <p className="random-pick-hint">Tap two teams to set the matchup</p>
                  <div className="random-teams-grid">
                    {randomTeams.map((t) => {
                      const isA = t.id === pickedA;
                      const isB = t.id === pickedB;
                      return (
                        <button
                          key={t.id}
                          className={`rand-team-card ${isA ? 'picked-a' : ''} ${isB ? 'picked-b' : ''}`}
                          onClick={() => {
                            if (isA) { setPickedA(null); }
                            else if (isB) { setPickedB(null); }
                            else if (!pickedA) { setPickedA(t.id); }
                            else if (!pickedB) { setPickedB(t.id); }
                            else { setPickedA(t.id); }
                          }}
                        >
                          <div className="rand-team-label">
                            {isA && <span className="rand-badge a">A</span>}
                            {isB && <span className="rand-badge b">B</span>}
                            {t.name}
                          </div>
                          <div className="rand-team-players">
                            {t.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(', ')}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Match preview */}
                  {pickedA && pickedB && (() => {
                    const tA = randomTeams.find((t) => t.id === pickedA)!;
                    const tB = randomTeams.find((t) => t.id === pickedB)!;
                    return (
                      <>
                        <div className="teams-preview">
                          <TeamCard team={tA} players={players} label="Team A" color="green" />
                          <div className="vs-badge">VS</div>
                          <TeamCard team={tB} players={players} label="Team B" color="blue" />
                        </div>
                        <button className="btn btn-success start-btn" onClick={handleStartRandom}>
                          Start Match <ChevronRight size={18} />
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Manual mode ── */}
      {mode === 'manual' && (
        <div className="manual-section">
          <div className="teams-builder">
            <div className="team-builder-col">
              <input className="text-input team-name-input" value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)} placeholder="Team A name" maxLength={20} />
              <div className="team-slots">
                {teamAIds.map((id) => {
                  const p = getPlayerById(id);
                  return p ? (
                    <div key={id} className="slot-chip green" onClick={() => toggleManual(id, 'A')}>{p.name} x</div>
                  ) : null;
                })}
                {teamAIds.length < teamSize && (
                  <div className="slot-empty">{teamSize - teamAIds.length} slot{teamSize - teamAIds.length !== 1 ? 's' : ''} open</div>
                )}
              </div>
            </div>

            <div className="vs-badge">VS</div>

            <div className="team-builder-col">
              <input className="text-input team-name-input" value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)} placeholder="Team B name" maxLength={20} />
              <div className="team-slots">
                {teamBIds.map((id) => {
                  const p = getPlayerById(id);
                  return p ? (
                    <div key={id} className="slot-chip blue" onClick={() => toggleManual(id, 'B')}>{p.name} x</div>
                  ) : null;
                })}
                {teamBIds.length < teamSize && (
                  <div className="slot-empty">{teamSize - teamBIds.length} slot{teamSize - teamBIds.length !== 1 ? 's' : ''} open</div>
                )}
              </div>
            </div>
          </div>

          <h3 className="players-pool-label">Player Pool – tap A or B to assign</h3>
          <div className="players-pool">
            {players.map((p) => {
              const inA = teamAIds.includes(p.id);
              const inB = teamBIds.includes(p.id);
              return (
                <div key={p.id} className={`pool-player ${inA ? 'in-a' : ''} ${inB ? 'in-b' : ''}`}>
                  <span className="pool-name">{p.name}</span>
                  <div className="pool-btns">
                    <button className={`pool-assign ${inA ? 'active-green' : ''}`}
                      onClick={() => toggleManual(p.id, 'A')}
                      disabled={!inA && teamAIds.length >= teamSize}>A</button>
                    <button className={`pool-assign ${inB ? 'active-blue' : ''}`}
                      onClick={() => toggleManual(p.id, 'B')}
                      disabled={!inB && teamBIds.length >= teamSize}>B</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="manual-actions">
            <button className="btn btn-ghost" onClick={resetManual}><RotateCcw size={14} /> Reset</button>
            <button className="btn btn-success start-btn" disabled={!canStartManual} onClick={handleStartManual}>
              Start Match <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk mode ── */}
      {mode === 'bulk' && (
        <div className="bulk-section">
          {/* Player pool */}
          <div className="bulk-pool-header">
            <span className="bulk-pool-label">Player pool</span>
            <button className="link-btn" onClick={() => { setBulkPoolIds(players.map((p) => p.id)); setFixtures([]); }}>All</button>
            <button className="link-btn" onClick={() => { setBulkPoolIds([]); setFixtures([]); }}>None</button>
          </div>
          <div className="bulk-pool-grid">
            {players.map((p) => (
              <button
                key={p.id}
                className={`bulk-pool-chip ${bulkPoolIds.includes(p.id) ? 'active' : ''}`}
                onClick={() => toggleBulkPlayer(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {bulkPool.length > 0 && bulkPool.length < teamSize * 2 && (
            <p className="empty-hint" style={{ fontSize: '0.82rem' }}>
              Select at least {teamSize * 2} players for {teamSize}v{teamSize}.
            </p>
          )}

          {/* Strategy selector */}
          <div className="bulk-strategy-row">
            <button
              className={`bestof-btn ${bulkStrategy === 'round-robin' ? 'active' : ''}`}
              onClick={() => { setBulkStrategy('round-robin'); setFixtures([]); }}
            >
              Round Robin{rrMatchCount > 0 ? ` · ${rrMatchCount} matches` : ''}
            </button>
            <button
              className={`bestof-btn ${bulkStrategy === 'random' ? 'active' : ''}`}
              onClick={() => { setBulkStrategy('random'); setFixtures([]); }}
            >
              Random
            </button>
            {bulkStrategy === 'random' && (
              <div className="bulk-count-row">
                <button className="count-btn" onClick={() => setBulkCount(Math.max(1, bulkCount - 1))}>−</button>
                <span className="count-val">{bulkCount}</span>
                <button className="count-btn" onClick={() => setBulkCount(Math.min(20, bulkCount + 1))}>+</button>
                <span className="count-label">matches</span>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={bulkPool.length < teamSize * 2}
            onClick={handleGenerate}
          >
            <Shuffle size={14} /> Generate fixtures
          </button>

          {/* Fixture preview list */}
          {fixtures.length > 0 && (
            <div className="fixture-list">
              <div className="fixture-list-header">
                <span>{fixtures.length} fixture{fixtures.length !== 1 ? 's' : ''}</span>
                <button className="link-btn" onClick={handleGenerate}><RefreshCw size={12} /> Re-roll all</button>
              </div>
              {fixtures.map((f, i) => (
                <div key={f.id} className="fixture-row">
                  <span className="fixture-num">{i + 1}</span>
                  <span className="fixture-team green-text">
                    {f.teamA.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(' & ')}
                  </span>
                  <span className="fixture-vs">vs</span>
                  <span className="fixture-team blue-text">
                    {f.teamB.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(' & ')}
                  </span>
                  <button className="icon-btn icon-btn-sm" title="Re-roll this fixture" onClick={() => rerollFixture(f.id)}>
                    <RefreshCw size={11} />
                  </button>
                  <button className="icon-btn red icon-btn-sm" title="Remove" onClick={() => removeFixture(f.id)}>
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          {fixtures.length > 0 && (
            <div className="bulk-actions">
              {sessions.length > 0 && (
                <select
                  className="setting-select"
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                >
                  <option value="">— No session —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              {targetSessionId && (
                <button className="btn btn-primary" onClick={handleAddAllToSession}>
                  <List size={14} /> Queue all {fixtures.length}
                </button>
              )}
              <button className="btn btn-success" onClick={handleStartFirstQueueRest}>
                <Play size={14} />
                {fixtures.length === 1
                  ? 'Start match'
                  : targetSessionId
                    ? `Start #1 · queue ${fixtures.length - 1}`
                    : `Start match 1 of ${fixtures.length}`}
              </button>
            </div>
          )}

          {addedCount !== null && (
            <div className="bulk-success">
              ✓ {addedCount} fixture{addedCount !== 1 ? 's' : ''} added to session queue
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, players, label, color }: {
  team: Team; players: Player[]; label: string; color: 'green' | 'blue';
}) {
  return (
    <div className={`team-card ${color}`}>
      <div className="team-card-label">{label}</div>
      {team.playerIds.map((id) => {
        const p = players.find((pl) => pl.id === id);
        return p ? (
          <div key={id} className="team-card-player">
            <span className="player-avatar small">{p.name[0].toUpperCase()}</span>
            {p.name}
          </div>
        ) : null;
      })}
    </div>
  );
}
