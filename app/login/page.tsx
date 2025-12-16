"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizeError, useSessionGuard } from "@/lib/ui-auth";

export default function LoginPage() {
  useSessionGuard({ requireAuth: false, redirectAuthenticatedTo: "/" });
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      router.push("/");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container py-5" style={{ maxWidth: "540px" }}>
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h1 className="h4 fw-semibold mb-3">Sign in</h1>
          <form className="row g-3" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="col-12">
                <div className="alert alert-danger mb-0 py-2" role="alert">
                  {error}
                </div>
              </div>
            )}
            <div className="col-12">
              <label htmlFor="login-email" className="form-label">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="col-12">
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="col-12 d-flex align-items-center justify-content-between">
              <Link href="/signup" className="small">
                Create account
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
