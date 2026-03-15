import { useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';

// The single Firestore document that holds all shared state
const STATE_DOC = doc(db, 'data', 'state');

// Keys synced to Firestore (UI state stays local)

export function useFirebaseSync() {
  const store = useStore();
  const isRemoteUpdate = useRef(false);
  const initialized = useRef(false);

  // ── On mount: load remote state first, then subscribe to changes ──
  useEffect(() => {
    // 1. Do an initial fetch to hydrate immediately
    getDoc(STATE_DOC).then((snap) => {
      if (snap.exists()) {
        isRemoteUpdate.current = true;
        const data = snap.data();
        useStore.setState({
          players: data.players ?? [],
          matches: data.matches ?? [],
          sessions: data.sessions ?? [],
        });
        isRemoteUpdate.current = false;
      } else {
        // First device — push local data to Firestore
        const s = useStore.getState();
        setDoc(STATE_DOC, {
          players: s.players,
          matches: s.matches,
          sessions: s.sessions,
        });
      }
      initialized.current = true;
    });

    // 2. Real-time listener — fires whenever another device writes
    const unsub = onSnapshot(STATE_DOC, (snap) => {
      if (!initialized.current) return; // skip before initial fetch resolves
      if (!snap.exists()) return;
      isRemoteUpdate.current = true;
      const data = snap.data();
      useStore.setState({
        players: data.players ?? [],
        matches: data.matches ?? [],
        sessions: data.sessions ?? [],
      });
      isRemoteUpdate.current = false;
    });

    return () => unsub();
  }, []);

  // ── On every local state change: push to Firestore ──
  useEffect(() => {
    if (isRemoteUpdate.current) return; // don't echo back remote updates
    if (!initialized.current) return;

    const { players, matches, sessions } = store;
    setDoc(STATE_DOC, { players, matches, sessions }, { merge: false });
  }, [store.players, store.matches, store.sessions]);
}
