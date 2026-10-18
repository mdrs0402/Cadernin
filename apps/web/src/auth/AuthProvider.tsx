import { onIdTokenChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth, googleProvider } from '../lib/firebase';

type AuthState = {
  user: User | null;
  /** true até o Firebase dizer se há sessão salva. */
  initializing: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Abre o seletor do Google; se o usuário cancelar, continua na conta atual. */
  switchAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onIdTokenChanged(auth, (u) => {
        setUser(u);
        setInitializing(false);
      }),
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signInWithGoogle: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      switchAccount: async () => {
        const previousUid = auth.currentUser?.uid;
        const { user: next } = await signInWithPopup(auth, googleProvider);
        if (next.uid !== previousUid) await queryClient.resetQueries();
      },
      signOut: async () => {
        await fbSignOut(auth);
        queryClient.clear();
      },
    }),
    [user, initializing, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
