"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Session = {
  sub: string;
  email: string;
};

const NavBar = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (!res.ok) {
        setSession(null);
        return;
      }
      const data = await res.json();
      setSession(data.session);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setSession(null);
      router.push("/login");
    }
  };

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary mb-4">
      <div className="container">
        <Link className="navbar-brand fw-semibold" href="/">
          Medicine Reminder
        </Link>
        <div className="d-flex align-items-center gap-2 ms-auto">
          {!loading && session && (
            <>
              <span className="text-secondary small">Hi, {session.email}</span>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
          {!loading && !session && !isAuthPage && (
            <Link className="btn btn-primary btn-sm" href="/login">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
