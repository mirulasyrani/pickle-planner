import { useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';

const STATE_DOC = doc(db, 'data', 'state');

export function useFirebaseSync() {
  const initialized = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the write-ID we last sent so we can identify our own echo exactly
  const lastWriteId = useRef('');

  // ── On mount: pull latest from Firestore, then listen for remote changes ──
  useEffect(() => {
    getDoc(STATE_DOC).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useStore.setState({
          players: data.players ?? [],
          matches: data.matches ?? [],
          sessions: data.sessions ?? [],
        });
      } else {
        // First device ever — seed Firestore with local data
        const s = useStore.getState();
        setDoc(STATE_DOC, { players: s.players, matches: s.matches, sessions: s.sessions, _wid: '' });
      }
      initialized.current = true;
    });

    // Real-time listener
    const unsub = onSnapshot(
      STATE_DOC,
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) return;
        if (snap.metadata.hasPendingWrites) return; // optimistic local write — skip
        if (!initialized.current) return;
        // Skip if we have un-flushed local changes (user is mid-edit)
        if (writeTimer.current !== null) return;
        // Skip if this snapshot is the echo of our own last write
        const incoming = snap.data();
        if (incoming._wid && incoming._wid === lastWriteId.current) return;
        useStore.setState({
          players: incoming.players ?? [],
          matches: incoming.matches ?? [],
          sessions: incoming.sessions ?? [],
        });
      }
    );

    return () => {
      unsub();
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  // ── Debounced write: waits 600ms after last change before pushing ──
  useEffect(() => {
    if (!initialized.current) return;

    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeTimer.current = null; // clear BEFORE setDoc so snapshot guard works correctly
      const wid = Math.random().toString(36).slice(2, 10);
      lastWriteId.current = wid;
      const { players, matches, sessions } = useStore.getState();
      setDoc(STATE_DOC, { players, matches, sessions, _wid: wid });
    }, 600);
  });
}
