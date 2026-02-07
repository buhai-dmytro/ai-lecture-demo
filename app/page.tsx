"use client";

import { useMemo, useState, type FormEvent } from "react";

type UserProfile = {
  userId: string;
  name: string;
  email: string;
  status: "Active" | "Suspended";
  tier: "Free" | "Pro" | "Enterprise";
  appVersion: string;
  deviceType: "iOS" | "Android" | "Web";
  lastSeen: string;
};

type ActivityLog = {
  id: string;
  at: string;
  action: string;
  statusCode: number;
  metadata: string;
};

type AgentData = {
  profile: UserProfile;
  logs: ActivityLog[];
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorCount = useMemo(() => {
    return data?.logs.filter((log) => log.statusCode >= 400).length ?? 0;
  }, [data]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter an email or userId to search.");
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agent?query=${encodeURIComponent(trimmed)}`);
      const payload = await response.json();
      if (!response.ok) {
        setData(null);
        setError(payload?.error ?? "User not found.");
        return;
      }

      setData(payload as AgentData);
    } catch {
      setData(null);
      setError("Unable to load user data. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-teal-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Agent Assist
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Customer Support Console
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Search a user to instantly surface account status, device context, and the latest
                activity trail.
              </p>
            </div>
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live tools ready
            </div>
          </div>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm md:flex-row md:items-center"
          >
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Search user
              </label>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="jane@company.com or usr_98ab21"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </header>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <main className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_2.2fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                User profile
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  data?.profile.status === "Suspended"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {data?.profile.status ?? "No user"}
              </span>
            </div>

            {data ? (
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{data.profile.name}</p>
                  <p className="text-slate-600">{data.profile.email}</p>
                  <p className="text-xs text-slate-500">User ID: {data.profile.userId}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Tier</p>
                    <p className="text-sm font-semibold text-slate-900">{data.profile.tier}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Device</p>
                    <p className="text-sm font-semibold text-slate-900">{data.profile.deviceType}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">App</p>
                    <p className="text-sm font-semibold text-slate-900">{data.profile.appVersion}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Last seen</p>
                    <p className="text-sm font-semibold text-slate-900">{data.profile.lastSeen}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-500">
                Search to load a user profile and see account details.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Activity & errors
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {data ? "Last 10 actions" : "Awaiting search"}
                </p>
              </div>
              {data ? (
                <div className="text-right text-xs text-slate-500">
                  <p>{data.logs.length} events</p>
                  <p className={errorCount > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {errorCount} errors
                  </p>
                </div>
              ) : null}
            </div>

            {data ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.logs.map((log) => {
                      const hasError = log.statusCode >= 400;
                      return (
                        <tr
                          key={log.id}
                          className={hasError ? "bg-rose-50/70" : "bg-white"}
                        >
                          <td className="px-4 py-3 text-xs text-slate-500">{log.at}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                hasError
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {log.statusCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{log.metadata}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Run a search to render the latest activity logs.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Quick actions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Trigger common remediation tasks.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Reset Password",
                "Clear Cache",
                "Force Logout",
                "Send Verification",
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    console.log(`Action: ${action}`, data?.profile.userId ?? "no-user")
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {action}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Actions log to the console for now.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
