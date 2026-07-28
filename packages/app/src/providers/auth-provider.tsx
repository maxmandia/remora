import { createContext, type ReactNode, useContext } from "react";

export type AuthStatus = "loading" | "signed-in" | "signed-out";
export type AuthRole = "admin" | "user";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  image: string | null;
};

export type AuthContextValue = {
  user: AuthUser | null;
  impersonatedBy: string | null;
  status: AuthStatus;
  error: string | null;
  requestAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  stopImpersonating: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AuthContextValue;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("Auth consumers must be rendered inside AuthProvider.");
  }

  return context;
}
