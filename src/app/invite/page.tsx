"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import Link from "next/link";

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsAccount, setNeedsAccount] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (!token) return;
    // Peek at the invite to know if the email already has an account
    fetch(`/api/org/invite/peek?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.email) setInviteEmail(d.email);
        setNeedsAccount(!d.hasAccount);
      })
      .catch(() => setError("Invalid or expired invite link."));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/org/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: needsAccount ? name : undefined, password: needsAccount ? password : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to accept invite."); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FlaskConical size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accept your invite</h1>
          {inviteEmail && <p className="text-sm text-gray-500 mt-1">Invited as <strong>{inviteEmail}</strong></p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {!token ? (
            <p className="text-sm text-gray-600 text-center">
              Invalid invite link. <Link href="/login" className="text-blue-600 hover:underline">Sign in instead</Link>
            </p>
          ) : error ? (
            <div>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Link href="/login" className="text-sm text-blue-600 hover:underline">Go to login</Link>
            </div>
          ) : needsAccount === null ? (
            <p className="text-sm text-gray-500 text-center">Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsAccount && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Create password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" minLength={8} required className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </>
              )}
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? "Joining…" : needsAccount ? "Create account & join" : "Accept invite"}
              </button>
              {!needsAccount && (
                <p className="text-xs text-gray-500 text-center">You already have an account. Click above to join the workspace.</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return <Suspense><InviteForm /></Suspense>;
}
