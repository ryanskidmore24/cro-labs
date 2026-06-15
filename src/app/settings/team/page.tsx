"use client";

import { useState, useEffect } from "react";
import { UserPlus, Trash2, ChevronDown } from "lucide-react";

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; avatar: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");

  async function load() {
    const [meRes, membersRes] = await Promise.all([
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/org/members").then(r => r.json()),
    ]);
    if (meRes.user) { setCurrentUserId(meRes.user.id); setCurrentRole(meRes.orgRole); }
    if (membersRes.members) setMembers(membersRes.members);
    if (membersRes.invites) setInvites(membersRes.invites);
  }

  useEffect(() => { load(); }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setSending(true);
    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send invite."); return; }
      setSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      load();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function revokeInvite(email: string) {
    await fetch(`/api/org/invite?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    load();
  }

  async function removeMember(userId: string) {
    await fetch("/api/org/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load();
  }

  async function changeRole(userId: string, role: string) {
    await fetch("/api/org/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    load();
  }

  const canManage = currentRole === "OWNER" || currentRole === "ADMIN";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Team</h1>
      <p className="text-sm text-gray-500 mb-6">Manage members and invitations</p>

      {/* Invite form */}
      {canManage && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Invite a teammate</h2>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
          <form onSubmit={sendInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <UserPlus size={14} />
              {sending ? "Sending…" : "Invite"}
            </button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Members ({members.length})</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {members.map(m => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-medium flex-shrink-0">
                {(m.user.name || m.user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.user.name || m.user.email}</p>
                {m.user.name && <p className="text-xs text-gray-500 truncate">{m.user.email}</p>}
              </div>
              {canManage && m.user.id !== currentUserId ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.user.id, e.target.value)}
                    disabled={m.role === "OWNER"}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white disabled:opacity-50"
                  >
                    {m.role === "OWNER" && <option value="OWNER">Owner</option>}
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  {m.role !== "OWNER" && (
                    <button onClick={() => removeMember(m.user.id)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-500 capitalize">{m.role.toLowerCase()}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Pending invites ({invites.length})</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {invites.map(inv => (
              <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-sm flex-shrink-0">
                  ?
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                </div>
                <span className="text-xs text-gray-500 capitalize mr-2">{inv.role.toLowerCase()}</span>
                {canManage && (
                  <button onClick={() => revokeInvite(inv.email)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
