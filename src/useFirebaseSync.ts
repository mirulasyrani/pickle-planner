import { useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';

const STATE_DOC = doc(db, 'data', 'state');

export function useFirebaseSync() {
  const initialized = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress incoming snapshots for 2s after we write, to avoid confirmed-echo bounce-back
  const suppressUntil = useRef(0);

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
        setDoc(STATE_DOC, { players: s.players, matches: s.matches, sessions: s.sessions });
      }
      initialized.current = true;
    });

    // Real-time listener — skip our own writes (pending + confirmed echo)
    const unsub = onSnapshot(
      STATE_DOC,
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) return;
        if (snap.metadata.hasPendingWrites) return; // local write still in flight
        if (!initialized.current) return;
        if (Date.now() < suppressUntil.current) return; // confirmed-write echo window
        const data = snap.data();
        useStore.setState({
          players: data.players ?? [],
          matches: data.matches ?? [],
          sessions: data.sessions ?? [],
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
      suppressUntil.current = Date.now() + 2000; // ignore echoes for 2s after write
      const { players, matches, sessions } = useStore.getState();
      setDoc(STATE_DOC, { players, matches, sessions });
    }, 600);
  });
}
