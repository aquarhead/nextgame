import { createSignal, Show } from "solid-js";
import * as api from "../api";

export default function Home() {
  const [teamName, setTeamName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  // Demo mode: show result with dummy data via /?demo
  const isDemo = new URLSearchParams(window.location.search).has("demo");
  const [result, setResult] = createSignal<{ name: string; teamLink: string; adminLink: string } | null>(
    isDemo
      ? {
          name: "Sunday Football",
          teamLink: `${window.location.origin}/team/abc123`,
          adminLink: `${window.location.origin}/admin/abc123/secret456`,
        }
      : null
  );

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    const name = teamName().trim();
    if (!name) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await api.createTeam(name);
      const origin = window.location.origin;
      setResult({
        name,
        teamLink: `${origin}/team/${resp.team_key}`,
        adminLink: `${origin}/admin/${resp.team_key}/${resp.team_secret}`,
      });
    } catch (e: any) {
      setError(e.message || "Failed to create team");
    }
    setLoading(false);
  };

  return (
    <div class="flex items-center justify-center min-h-screen px-6">
      <div class="glass-card rounded-[2.5rem] p-10 max-w-lg w-full">
        <h1 class="text-6xl font-brand font-normal mb-2 text-center">
          next<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">game</span>
        </h1>
        <p class="text-slate-400 text-center mb-8 font-brand italic tracking-wide">Who's playing?!</p>

        <Show when={result()} fallback={
          <form onSubmit={onSubmit} class="space-y-5">
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Team name</label>
              <input
                type="text"
                value={teamName()}
                onInput={(e) => setTeamName(e.currentTarget.value)}
                required
                class="w-full glass-input rounded-2xl px-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all"
                placeholder="Enter your team name"
              />
            </div>
            <Show when={error()}>
              <p class="text-[var(--accent-danger)] text-sm">{error()}</p>
            </Show>
            <button
              type="submit"
              disabled={loading()}
              class="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:opacity-90 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading() ? "Creating..." : "Create Team"}
            </button>
          </form>
        }>
          {(r) => (
            <div class="space-y-6">
              <div class="flex items-center gap-3 text-[var(--accent-turquoise)]">
                <i class="ph ph-check-circle text-2xl" />
                <p class="font-bold text-lg">Team "{r().name}" created!</p>
              </div>

              <div class="space-y-3 p-5 bg-white/5 rounded-2xl border border-white/10">
                <label class="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-widest flex items-center gap-2">
                  <i class="ph ph-link" />
                  Team page
                </label>
                <p class="text-sm text-slate-400">Share this link with all players so they can register for games.</p>
                <a href={r().teamLink} class="block text-[var(--accent-cyan)] hover:underline break-all text-sm font-medium">
                  {r().teamLink}
                </a>
              </div>

              <div class="space-y-3 p-5 bg-[var(--accent-warning)]/10 rounded-2xl border border-[var(--accent-warning)]/30">
                <label class="text-xs font-bold text-[var(--accent-warning)] uppercase tracking-widest flex items-center gap-2">
                  <i class="ph ph-warning" />
                  Admin page — save this!
                </label>
                <p class="text-sm text-slate-300">This is your <strong>only chance</strong> to see this link. Bookmark it or save it somewhere safe. You need it to manage your team, create games, and configure settings.</p>
                <a href={r().adminLink} class="block text-[var(--accent-warning)] hover:underline break-all text-sm font-medium">
                  {r().adminLink}
                </a>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
