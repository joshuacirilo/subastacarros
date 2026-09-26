"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/lib/domain";
type Session = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
const Context = createContext<Session>({
  user: null,
  loading: true,
  refresh: async () => {},
});
export function useSession() {
  return useContext(Context);
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  async function refresh() {
    try {
      const r = await fetch("/api/auth/sesion", { cache: "no-store" });
      const d = await r.json();
      setUser(d.user ?? null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh().catch(() => setLoading(false));
  }, []);
  return (
    <Context.Provider value={{ user, loading, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function Header() {
  const { user, loading, refresh } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    try {
      const r = await fetch("/api/auth/salir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error();
      await refresh();
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo cerrar sesión. Intenta de nuevo.");
    }
  }
  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark">S</span>Subasta
          <span className="brand-accent">GT</span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/">Explorar vehículos</Link>
          {user ? (
            <>
              <Link href="/mis-publicaciones">Mis publicaciones</Link>
              <Link className="button small" href="/publicar">
                Publicar vehículo
              </Link>
              <span className="user-name">{user.nombre}</span>
              <button className="text-button" onClick={logout}>
                Salir
              </button>
            </>
          ) : !loading ? (
            <>
              <Link href="/ingresar">Ingresar</Link>
              <Link className="button small" href="/registro">
                Crear cuenta
              </Link>
            </>
          ) : (
            <span className="muted">Cargando…</span>
          )}
        </nav>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
