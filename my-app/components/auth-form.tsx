"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "./session";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const { refresh } = useSession();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(
        "/api/auth/" + (register ? "registro" : "ingresar"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <span className="eyebrow">TU PRÓXIMA OPORTUNIDAD</span>
        <h1>
          {register
            ? "El siguiente vehículo empieza aquí."
            : "Qué bueno verte de nuevo."}
        </h1>
        <p>
          Explora, publica y participa en subastas de vehículos en Guatemala.
          Cada oferta cuenta.
        </p>
        <div className="info-note">
          Las ofertas son privadas. Solo tú puedes ver si vas ganando.
        </div>
      </section>
      <section className="panel auth-panel">
        <h2>{register ? "Crear tu cuenta" : "Iniciar sesión"}</h2>
        <p className="muted">
          {register
            ? "Todos los usuarios pueden publicar y ofertar."
            : "Ingresa para publicar o hacer una oferta."}
        </p>
        <form onSubmit={submit} className="stack">
          {register && (
            <>
              <div className="two-cols">
                <label>
                  Nombre
                  <input
                    name="nombre"
                    required
                    maxLength={100}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Apellido
                  <input
                    name="apellido"
                    required
                    maxLength={100}
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <label>
                Teléfono
                <input
                  name="telefono"
                  type="tel"
                  required
                  minLength={8}
                  maxLength={25}
                  autoComplete="tel"
                />
              </label>
            </>
          )}
          <label>
            Correo electrónico
            <input
              name="correo"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              aria-label="Contraseña"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
            />
            <small>Al menos 12 caracteres.</small>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Procesando…" : register ? "Crear cuenta" : "Ingresar"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
          <Link href={register ? "/ingresar" : "/registro"}>
            {register ? "Inicia sesión" : "Regístrate"}
          </Link>
        </p>
      </section>
    </main>
  );
}
