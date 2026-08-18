/**
 * Who this app belongs to, held in one place.
 *
 * WHY THIS EXISTS. The first version read the intake inside the dashboard's
 * own mount effect. Tab screens stay mounted in the background, so after the
 * onboarding saved and navigated back, that effect never ran again — the
 * dashboard still believed there was no intake and redirected straight back
 * to the onboarding. Pressing "Fertig" looked like it did nothing.
 *
 * Holding the state above both screens fixes it properly: the onboarding
 * refreshes this provider before it navigates, so the dashboard renders the
 * new state on its very first frame. No re-read, no loading flash, and no
 * chance of the two screens disagreeing about whether setup is done.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Intake } from './intake';
import { loadIntake } from './storage';

type Session = {
  /** null once `ready`, if this device has no intake yet. */
  intake: Intake | null;
  /** false until the first read finishes — do NOT route on the state before this. */
  ready: boolean;
  /** Re-read from storage. Call after saving, before navigating. */
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Session>({
  intake: null,
  ready: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setIntake(await loadIntake());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ intake, ready, refresh }), [intake, ready, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
