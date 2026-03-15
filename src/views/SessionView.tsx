import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { Session, PlannedMatch, Team } from '../types';
import {
  Calendar, Clock, MapPin, Bell, BellOff, Users, Trash2,
  Play, ChevronDown, ChevronUp, Plus, Trophy,
  UserX, UserCheck, Pencil, Swords,
} from 'lucide-react';
import { buildSocialRoundRobin, estimateFixtureCount } from '../utils/schedule';

// ── Notification helpers ─────────────────────────────────────────────────────
function scheduleNotification(session: Session) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!session.alertEnabled || !session.date || !session.time) return;
  const [h, m] = session.time.split(':').map(Number);
  const sessionMs = new Date(`${session.date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime();
  const alertMs = sessionMs - session.alertMinutesBefore * 60 * 1000;
  const delay = alertMs - Date.now();
  if (delay <= 0) return;
  const timer = window.setTimeout(() => {
    new Notification(`🥒 Pickleball in ${session.alertMinutesBefore}m`, {
      body: `${session.name} @ ${session.location || 'your spot'} at ${session.time}`,
      icon: '/favicon.ico',
    });
  }, delay);
  // Store the timer id in a module-level map so we don't leak
  sessionTimers.set(session.id, timer);
}

const sessionTimers = new Map<string, number>();

function clearSessionTimer(sessionId: string) {
  const t = sessionTimers.get(sessionId);
  if (t != null) { window.clearTimeout(t); sessionTimers.delete(sessionId); }
}

// ── Main component ───────────────────────────────────────────────────────────
export function SessionView() {
  const {
    sessions, players, matches,
    createSession, updateSession, deleteSession, setActiveSession,
    addPlannedMatch, removePlannedMatch, clearPlannedMatches, launchPlannedMatch, markPlayerAbsent,
    setNotificationGranted, activeSessionId,
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[sessions.length - 1] ?? null;

  // Auto-open the form if there are no sessions yet
  useEffect(() => {
    if (sessions.length === 0) setShowForm(true);
  }, [sessions.length]);

  return (
    <div className="view">
      <div className="session-header-row">
        <h2 className="view-title">Sessions</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> New session
        </button>
      </div>

      {showForm && (
        <SessionForm
          players={players}
          onSave={(data) => { createSession(data); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sessions.length === 0 && !showForm && (
        <p className="empty-hint">No sessions yet. Create one to plan a day of pickleball!</p>
      )}

      {sessions.length > 0 && (
        <div className="session-tabs-row">
          {[...sessions].reverse().map((s) => (
            <button
              key={s.id}
              className={`session-tab ${s.id === activeSession?.id ? 'active' : ''}`}
              onClick={() => setActiveSession(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {activeSession && (
        <SessionDetail
          session={activeSession}
          allPlayers={players}
          allMatches={matches}
          onUpdate={(data) => updateSession(activeSession.id, data)}
          onDelete={() => { deleteSession(activeSession.id); }}
          onAddPlanned={(tA, tB, bo) => addPlannedMatch(activeSession.id, tA, tB, bo)}
          onRemovePlanned={(pmId) => removePlannedMatch(activeSession.id, pmId)}
          onClearAll={() => clearPlannedMatches(activeSession.id)}
          onLaunch={(pmId) => launchPlannedMatch(activeSession.id, pmId)}
          onMarkAbsent={(pId, absent) => markPlayerAbsent(activeSession.id, pId, absent)}
          onNotificationGranted={(g) => setNotificationGranted(activeSession.id, g)}
        />
      )}
    </div>
  );
}

// ── Create/Edit session form ─────────────────────────────────────────────────
function SessionForm({
  players, initial, onSave, onCancel,
}: {
  players: { id: string; name: string }[];
  initial?: Partial<Session>;
  onSave: (data: Omit<Session, 'id' | 'plannedMatches' | 'createdAt' | 'notificationGranted'>) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState(initial?.name ?? 'Pickleball Session');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [date, setDate] = useState(initial?.date ?? today);
  const [time, setTime] = useState(initial?.time ?? '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [alertEnabled, setAlertEnabled] = useState(initial?.alertEnabled ?? true);
  const [alertMinutes, setAlertMinutes] = useState(initial?.alertMinutesBefore ?? 30);
  const [confirmed, setConfirmed] = useState<string[]>(initial?.confirmedPlayerIds ?? []);

  function toggleConfirmed(id: string) {
    setConfirmed((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  function handleSave() {
    onSave({ name: name.trim() || 'Session', location, date, time, endTime, format: 'doubles', bestOf: 1, alertEnabled, alertMinutesBefore: alertMinutes, confirmedPlayerIds: confirmed, absentPlayerIds: initial?.absentPlayerIds ?? [] });
  }

  return (
    <div className="session-form">
      <h3 className="session-form-title">{initial ? 'Edit session' : 'New session'}</h3>
      <div className="form-group">
        <label className="form-label">Session name</label>
        <input className="text-input w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label"><Calendar size={12} /> Date</label>
          <input className="text-input w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label"><Clock size={12} /> Start</label>
          <input className="text-input w-full" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label"><Clock size={12} /> End</label>
          <input className="text-input w-full" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="optional" />
        </div>
      </div>


      <div className="form-group">
        <label className="form-label"><MapPin size={12} /> Location</label>
        <input className="text-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Riverside courts, Court 3" maxLength={80} />
      </div>


      <div className="form-group">
        <label className="form-label"><Bell size={12} /> Alert</label>
        <div className="alert-row">
          <button
            className={`toggle-pill ${alertEnabled ? 'on' : ''}`}
            onClick={() => setAlertEnabled(!alertEnabled)}
          >
            {alertEnabled ? <Bell size={13} /> : <BellOff size={13} />}
            {alertEnabled ? 'On' : 'Off'}
          </button>
          {alertEnabled && (
            <select className="setting-select" value={alertMinutes} onChange={(e) => setAlertMinutes(Number(e.target.value))}>
              {[5, 10, 15, 30, 60, 120].map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m} min before` : `${m / 60}h before`}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {players.length > 0 && (
        <div className="form-group">
          <label className="form-label"><Users size={12} /> Confirmed players</label>
          <div className="confirmed-grid">
            {players.map((p) => (
              <button
                key={p.id}
                className={`confirmed-chip ${confirmed.includes(p.id) ? 'active' : ''}`}
                onClick={() => toggleConfirmed(p.id)}
              >
                {confirmed.includes(p.id) ? <UserCheck size={12} /> : <UserX size={12} />}
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save session</button>
      </div>
    </div>
  );
}

// ── Session detail ───────────────────────────────────────────────────────────
function SessionDetail({
  session, allPlayers, allMatches,
  onUpdate, onDelete, onAddPlanned, onRemovePlanned, onClearAll, onLaunch, onMarkAbsent, onNotificationGranted,
}: {
  session: Session;
  allPlayers: { id: string; name: string }[];
  allMatches: import('../types').Match[];
  onUpdate: (d: Partial<Omit<Session, 'id' | 'createdAt'>>) => void;
  onDelete: () => void;
  onAddPlanned: (tA: Team, tB: Team, bo: 1 | 3 | 5) => void;
  onRemovePlanned: (pmId: string) => void;
  onClearAll: () => void;
  onLaunch: (pmId: string) => void;
  onMarkAbsent: (pId: string, absent: boolean) => void;
  onNotificationGranted: (g: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const confirmedPlayers = allPlayers.filter((p) => session.confirmedPlayerIds.includes(p.id));
  const absentIds = session.absentPlayerIds ?? [];
  const availablePlayers = confirmedPlayers.filter((p) => !absentIds.includes(p.id));

  // Schedule/reschedule notification whenever session alert settings change
  useEffect(() => {
    clearSessionTimer(session.id);
    scheduleNotification(session);
    return () => clearSessionTimer(session.id);
  });

  async function requestNotificationPermission() {
    if (!('Notification' in window)) { alert('This browser does not support notifications.'); return; }
    const perm = await Notification.requestPermission();
    onNotificationGranted(perm === 'granted');
    if (perm === 'granted') {
      onUpdate({ alertEnabled: true });
      scheduleNotification({ ...session, notificationGranted: true, alertEnabled: true });
    }
  }

  const sessionDate = session.date ? new Date(`${session.date}T${session.time || '00:00'}`) : null;
  const isUpcoming = sessionDate ? sessionDate.getTime() > Date.now() : false;

  const liveMatchIds = new Set(
    allMatches.filter((m) => !m.isComplete && m.sessionId === session.id).map((m) => m.id)
  );

  if (editing) {
    return (
      <SessionForm
        players={allPlayers}
        initial={session}
        onSave={(data) => { onUpdate(data); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="session-detail">
      {/* ── Header ── */}
      <div className="session-info-card">
        <div className="session-info-main">
          <div className="session-name">{session.name}</div>
          <div className="session-meta-row">
            {session.date && (
              <span className="session-meta-item">
                <Calendar size={12} />
                {new Date(`${session.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            )}
            {session.time && <span className="session-meta-item"><Clock size={12} />{session.time}</span>}
            {session.location && <span className="session-meta-item"><MapPin size={12} />{session.location}</span>}
          </div>
          {isUpcoming && <span className="session-upcoming-badge">Upcoming</span>}
        </div>
        <div className="session-actions-row">
          <button className="icon-btn" onClick={() => setEditing(true)} title="Edit"><Pencil size={14} /></button>
          {deleteConfirm ? (
            <>
              <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={onDelete}>Confirm delete</button>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setDeleteConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button className="icon-btn red" onClick={() => setDeleteConfirm(true)} title="Delete session"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {/* ── Alert banner ── */}
      {session.alertEnabled && !session.notificationGranted && isUpcoming && (
        <div className="alert-banner">
          <Bell size={14} />
          <span>Get a reminder {session.alertMinutesBefore} min before this session</span>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={requestNotificationPermission}>
            Enable alerts
          </button>
        </div>
      )}
      {session.alertEnabled && session.notificationGranted && isUpcoming && (
        <div className="alert-banner active">
          <Bell size={14} />
          <span>You'll be reminded {session.alertMinutesBefore < 60 ? `${session.alertMinutesBefore} min` : `${session.alertMinutesBefore / 60}h`} before kick-off</span>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onUpdate({ alertEnabled: false })}>
            <BellOff size={12} /> Mute
          </button>
        </div>
      )}

      {/* ── Players attendance ── */}
      <SectionBlock
        title={`Players · ${availablePlayers.length} available`}
        icon={<Users size={14} />}
        expanded={expanded === 'players'}
        onToggle={() => setExpanded(expanded === 'players' ? null : 'players')}
      >
        {confirmedPlayers.length === 0 ? (
          <p className="empty-hint" style={{ marginTop: 8, fontSize: '0.82rem' }}>No confirmed players. Edit the session to add some.</p>
        ) : (
          <div className="attendance-list">
            {confirmedPlayers.map((p) => {
              const isAbsent = absentIds.includes(p.id);
              return (
                <div key={p.id} className={`attendance-row ${isAbsent ? 'absent' : 'present'}`}>
                  <span className="player-avatar small">{p.name[0].toUpperCase()}</span>
                  <span className="attendance-name">{p.name}</span>
                  <button
                    className={`attendance-toggle ${isAbsent ? 'mark-present' : 'mark-absent'}`}
                    onClick={() => onMarkAbsent(p.id, !isAbsent)}
                  >
                    {isAbsent ? <><UserCheck size={12} /> Show</> : <><UserX size={12} /> No-show</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionBlock>

      {/* ── Generate schedule ── */}
      <GenerateCard
        availablePlayers={availablePlayers}
        plannedMatches={session.plannedMatches}
        onGenerate={(fixtures) => {
          session.plannedMatches
            .filter((pm) => pm.matchId === null)
            .forEach((pm) => onRemovePlanned(pm.id));
          fixtures.forEach((f) => onAddPlanned(f.teamA, f.teamB, f.bestOf));
        }}
      />

      {/* ── Match queue ── */}
      <SectionBlock
        title={`Match queue · ${session.plannedMatches.length} planned`}
        icon={<Swords size={14} />}
        expanded={expanded === 'matches'}
        onToggle={() => setExpanded(expanded === 'matches' ? null : 'matches')}
        action={
          session.plannedMatches.length > 0
            ? confirmClear
              ? (
                <span className="clear-all-confirm">
                  Clear all?&nbsp;
                  <button className="btn-link danger" onClick={() => { onClearAll(); setConfirmClear(false); }}>Yes</button>
                  &nbsp;/&nbsp;
                  <button className="btn-link" onClick={() => setConfirmClear(false)}>No</button>
                </span>
              )
              : (
                <button className="btn-link danger" onClick={() => setConfirmClear(true)}>
                  Clear all
                </button>
              )
            : undefined
        }
      >
        {session.plannedMatches.length === 0 && (
          <p className="empty-hint" style={{ marginTop: 8, fontSize: '0.82rem' }}>No matches queued yet — hit Generate above to fill the queue.</p>
        )}
        <div className="planned-list">
          {session.plannedMatches.map((pm) => (
            <PlannedMatchRow
              key={pm.id}
              pm={pm}
              allPlayers={allPlayers}
              liveMatchIds={liveMatchIds}
              allMatches={allMatches}
              onLaunch={() => onLaunch(pm.id)}
              onRemove={() => onRemovePlanned(pm.id)}
            />
          ))}
        </div>
      </SectionBlock>

      {/* ── Session stats ── */}
      <SessionStatsPanel
        session={session}
        allPlayers={allPlayers}
        allMatches={allMatches}
        expanded={expanded === 'stats'}
        onToggle={() => setExpanded(expanded === 'stats' ? null : 'stats')}
      />
    </div>
  );
}

// ── Section accordion block ──────────────────────────────────────────────────
function SectionBlock({ title, icon, expanded, onToggle, children, action }: {
  title: string; icon?: React.ReactNode; expanded: boolean;
  onToggle: () => void; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="section-block">
      <button className="section-block-header" onClick={onToggle}>
        <span className="section-block-title">{icon}{title}</span>
        <div className="section-block-right">
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>
      {expanded && <div className="section-block-body">{children}</div>}
    </div>
  );
}

// ── Planned match row ────────────────────────────────────────────────────────
function PlannedMatchRow({ pm, allPlayers, liveMatchIds, allMatches, onLaunch, onRemove }: {
  pm: PlannedMatch;
  allPlayers: { id: string; name: string }[];
  liveMatchIds: Set<string>;
  allMatches: import('../types').Match[];
  onLaunch: () => void;
  onRemove: () => void;
}) {
  function names(ids: string[]) {
    return ids.map((id) => allPlayers.find((p) => p.id === id)?.name ?? '?').join(' & ');
  }

  const isLive = !!(pm.matchId && pm.matchId !== 'done' && liveMatchIds.has(pm.matchId));
  const isDone = pm.matchId === 'done' || !!(pm.matchId && !liveMatchIds.has(pm.matchId) && allMatches.find((m) => m.id === pm.matchId)?.isComplete);
  // Resolve the completed match when matchId is the real ID (new data) vs 'done' sentinel (old data)
  const completedMatch = (isDone && pm.matchId && pm.matchId !== 'done')
    ? allMatches.find((m) => m.id === pm.matchId && m.isComplete) ?? null
    : null;

  const isWinnerA = completedMatch ? completedMatch.winnerId === completedMatch.teamA.id : null;
  const totalA = completedMatch ? completedMatch.games.reduce((s, g) => s + g.teamAScore, 0) : 0;
  const totalB = completedMatch ? completedMatch.games.reduce((s, g) => s + g.teamBScore, 0) : 0;
  const gameWinsA = completedMatch ? completedMatch.games.filter((g) => g.winnerId === completedMatch.teamA.id).length : 0;
  const gameWinsB = completedMatch ? completedMatch.games.filter((g) => g.winnerId === completedMatch.teamB.id).length : 0;
  const scoreDisplay = completedMatch
    ? (completedMatch.bestOf > 1 ? `${gameWinsA}–${gameWinsB}` : `${totalA}–${totalB}`)
    : null;

  return (
    <div className={`planned-row ${isLive ? 'live' : ''} ${isDone ? 'done' : ''}`}>
      <div className="planned-info">
        <div className="planned-teams">
          <span className={`planned-team-a${isWinnerA === true ? ' team-winner' : ''}`}>{pm.teamA.name}</span>
          {completedMatch ? (
            <span className="planned-final-score">{totalA}–{totalB}</span>
          ) : (
            <span className="planned-vs">vs</span>
          )}
          <span className={`planned-team-b${isWinnerA === false ? ' team-winner' : ''}`}>{pm.teamB.name}</span>
        </div>
        <div className="planned-players">
          <span className="green-text">{names(pm.teamA.playerIds)}</span>
          <span className="text-muted"> · </span>
          <span className="blue-text">{names(pm.teamB.playerIds)}</span>
        </div>

      </div>
      <div className="planned-actions">
        {isDone ? (
          scoreDisplay ? (
            <span className="planned-badge score-done">{scoreDisplay}</span>
          ) : (
            <span className="planned-badge done">Done</span>
          )
        ) : isLive ? (
          <span className="planned-badge live">Live</span>
        ) : (
          <button className="btn btn-success" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={onLaunch}>
            <Play size={12} /> Start
          </button>
        )}
        {!isLive && (
          <button className="icon-btn red icon-btn-sm" onClick={onRemove}><Trash2 size={12} /></button>
        )}
      </div>
    </div>
  );
}


// ── Session stats panel ──────────────────────────────────────────────────────
function SessionStatsPanel({ session, allPlayers, allMatches, expanded, onToggle }: {
  session: Session;
  allPlayers: { id: string; name: string }[];
  allMatches: import('../types').Match[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const sessionMatches = allMatches.filter((m) => m.sessionId === session.id && m.isComplete);
  if (sessionMatches.length === 0) return null;

  type StatRow = { id: string; name: string; wins: number; losses: number; pointsScored: number; pointsConceded: number };
  const statsMap = new Map<string, StatRow>();

  function ensure(pid: string) {
    if (!statsMap.has(pid)) {
      const p = allPlayers.find((pl) => pl.id === pid);
      statsMap.set(pid, { id: pid, name: p?.name ?? '?', wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
    }
    return statsMap.get(pid)!;
  }

  for (const m of sessionMatches) {
    const winTeam = m.winnerId === m.teamA.id ? m.teamA : m.teamB;
    const loseTeam = m.winnerId === m.teamA.id ? m.teamB : m.teamA;
    const totalA = m.games.reduce((t, g) => t + g.teamAScore, 0);
    const totalB = m.games.reduce((t, g) => t + g.teamBScore, 0);
    const winPts = m.winnerId === m.teamA.id ? totalA : totalB;
    const losePts = m.winnerId === m.teamA.id ? totalB : totalA;
    for (const pid of winTeam.playerIds) {
      const r = ensure(pid);
      r.wins += 1; r.pointsScored += winPts; r.pointsConceded += losePts;
    }
    for (const pid of loseTeam.playerIds) {
      const r = ensure(pid);
      r.losses += 1; r.pointsScored += losePts; r.pointsConceded += winPts;
    }
  }

  const rows = [...statsMap.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.pointsScored - b.pointsConceded) - (a.pointsScored - a.pointsConceded);
  });

  return (
    <SectionBlock
      title={`Session leaderboard · ${sessionMatches.length} match${sessionMatches.length !== 1 ? 'es' : ''} played`}
      icon={<Trophy size={14} />}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="sstats-table">
        <div className="sstats-header">
          <span className="sstats-rank-col" />
          <span className="sstats-name-col">Player</span>
          <span className="sstats-num-col">W</span>
          <span className="sstats-num-col">L</span>
          <span className="sstats-num-col">Pts+</span>
          <span className="sstats-num-col">Pts−</span>
          <span className="sstats-num-col">Diff</span>
        </div>
        {rows.map((r, idx) => {
          const diff = r.pointsScored - r.pointsConceded;
          const isFirst = idx === 0 && r.wins > 0;
          return (
            <div key={r.id} className={`sstats-row${isFirst ? ' sstats-top' : ''}`}>
              <span className="sstats-rank-col">
                {isFirst ? <Trophy size={12} className="sstats-trophy" /> : <span className="sstats-rank-num">{idx + 1}</span>}
              </span>
              <span className="sstats-name-col">{r.name}</span>
              <span className="sstats-num-col win-col">{r.wins}</span>
              <span className="sstats-num-col loss-col">{r.losses}</span>
              <span className="sstats-num-col">{r.pointsScored}</span>
              <span className="sstats-num-col">{r.pointsConceded}</span>
              <span className={`sstats-num-col diff-col ${diff >= 0 ? 'pos' : 'neg'}`}>
                {diff >= 0 ? `+${diff}` : diff}
              </span>
            </div>
          );
        })}
      </div>
    </SectionBlock>
  );
}

// ── Generate schedule card ───────────────────────────────────────────────────
function GenerateCard({
  availablePlayers, plannedMatches, onGenerate,
}: {
  availablePlayers: { id: string; name: string }[];
  plannedMatches: import('../types').PlannedMatch[];
  onGenerate: (fixtures: import('../utils/schedule').ScheduledFixture[]) => void;
}) {
  const teamSize = 2;
  const n = availablePlayers.length;
  const estimated = estimateFixtureCount(n, teamSize);
  const notStarted = plannedMatches.filter((pm) => pm.matchId === null).length;
  const hasActive = plannedMatches.some((pm) => pm.matchId && pm.matchId !== 'done');

  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    const fixtures = buildSocialRoundRobin(availablePlayers, teamSize, 1);
    onGenerate(fixtures);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2500);
  }

  if (n < teamSize * 2) {
    return (
      <div className="generate-card insufficient">
        <Users size={14} />
        <span>
          {n === 0
            ? 'No players confirmed yet — edit the session to add them.'
            : `Need at least ${teamSize * 2} players confirmed.`}
        </span>
      </div>
    );
  }

  return (
    <div className="generate-card">
      <div className="generate-card-info">
        <span className="generate-meta">{n} players · ~{estimated} fixtures</span>
        {notStarted > 0 && !hasActive && (
          <span className="generate-warn">⚠ Replaces {notStarted} queued match{notStarted !== 1 ? 'es' : ''}</span>
        )}
      </div>
      <button
        className={`btn ${generated ? 'btn-success' : 'btn-primary'} generate-btn`}
        onClick={handleGenerate}
        disabled={hasActive}
        title={hasActive ? 'Finish live matches before regenerating' : undefined}
      >
        {generated ? '✓ Schedule generated!' : `Generate ${estimated} match${estimated !== 1 ? 'es' : ''}`}
      </button>
    </div>
  );
}
