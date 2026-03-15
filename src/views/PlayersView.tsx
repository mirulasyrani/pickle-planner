import { useState } from 'react';
import { useStore } from '../store';
import { UserPlus, Trash2, Pencil, Check, X } from 'lucide-react';

export function PlayersView() {
  const { players, addPlayer, removePlayer, renamePlayer } = useStore();
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    addPlayer(trimmed);
    setInput('');
  }

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditValue(name);
  }

  function commitEdit(id: string) {
    if (editValue.trim()) renamePlayer(id, editValue.trim());
    setEditingId(null);
  }

  return (
    <div className="view">
      <h2 className="view-title">Players</h2>
      <p className="view-subtitle">Add everyone who\'s playing today.</p>

      <div className="add-row">
        <input
          className="text-input"
          placeholder="Player name..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          maxLength={30}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          <UserPlus size={16} />
          Add
        </button>
      </div>

      {players.length === 0 ? (
        <p className="empty-hint">No players yet. Add at least 2 to start!</p>
      ) : (
        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id} className="player-item">
              {editingId === p.id ? (
                <>
                  <input
                    className="text-input inline-edit"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(p.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    maxLength={30}
                  />
                  <button className="icon-btn green" onClick={() => commitEdit(p.id)}><Check size={15} /></button>
                  <button className="icon-btn red" onClick={() => setEditingId(null)}><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className="player-avatar">{p.name[0].toUpperCase()}</span>
                  <span className="player-name">{p.name}</span>
                  <div className="player-stats-mini">
                    <span className="stat-badge win">{p.wins}W</span>
                    <span className="stat-badge loss">{p.losses}L</span>
                  </div>
                  <button className="icon-btn" onClick={() => startEdit(p.id, p.name)}><Pencil size={15} /></button>
                  <button className="icon-btn red" onClick={() => removePlayer(p.id)}><Trash2 size={15} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="player-count-hint">
        {players.length} player{players.length !== 1 ? 's' : ''} registered
      </div>
    </div>
  );
}
