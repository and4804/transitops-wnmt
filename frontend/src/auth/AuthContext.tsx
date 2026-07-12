import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { AuthResponse, Role, User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role: Role) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadUser(): User | null {
  const raw = localStorage.getItem("transitops_user");
  return raw ? (JSON.parse(raw) as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser());

  function persist(auth: AuthResponse) {
    localStorage.setItem("transitops_token", auth.token);
    localStorage.setItem("transitops_user", JSON.stringify(auth.user));
    setUser(auth.user);
  }

  async function login(email: string, password: string) {
    const auth = await api.post<AuthResponse>("/auth/login", { email, password });
    persist(auth);
  }

  async function signup(name: string, email: string, password: string, role: Role) {
    const auth = await api.post<AuthResponse>("/auth/signup", { name, email, password, role });
    persist(auth);
  }

  async function loginWithGoogle(credential: string) {
    const auth = await api.post<AuthResponse>("/auth/google", { credential });
    persist(auth);
  }

  function logout() {
    localStorage.removeItem("transitops_token");
    localStorage.removeItem("transitops_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
