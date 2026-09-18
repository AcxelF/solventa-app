import { useState } from "react";
import { Lock } from "lucide-react";
import { login } from "../api.js";
import Button from "./ui/Button.jsx";
import TextInput from "./ui/TextInput.jsx";

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-soft"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-text text-sm font-bold text-bg">
            S/
          </span>
          <div>
            <h1 className="text-lg font-semibold text-text">Solventa</h1>
            <p className="text-xs text-text-muted">Acceso privado</p>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
            Contraseña
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <TextInput
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-9"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-negative">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          disabled={loading || !password}
          className="mt-5 w-full"
        >
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
