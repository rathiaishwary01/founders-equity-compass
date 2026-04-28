// Auth removed — EquiCompass runs fully client-side without accounts.
import { createContext, useContext } from "react";

const AuthContext = createContext<null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return { user: null as null, loading: false, signOut: () => {} };
}
