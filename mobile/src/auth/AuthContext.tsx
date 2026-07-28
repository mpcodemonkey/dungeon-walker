import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, signup as apiSignup, fetchMe, type AuthUser, type Character } from '../api/client';

const TOKEN_KEY = 'dungeon-walker-token';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser; character: Character };

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, characterName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setState({ status: 'signed-out' });
        return;
      }
      try {
        const me = await fetchMe(token);
        setState({ status: 'signed-in', user: me.user, character: me.character });
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setState({ status: 'signed-out' });
      }
    })();
  }, []);

  async function signIn(email: string, password: string) {
    const res = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setState({ status: 'signed-in', user: res.user, character: res.character });
  }

  async function signUp(email: string, password: string, characterName: string) {
    const res = await apiSignup(email, password, characterName);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setState({ status: 'signed-in', user: res.user, character: res.character });
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setState({ status: 'signed-out' });
  }

  return <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
