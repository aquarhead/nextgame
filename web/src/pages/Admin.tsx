import { createSignal, onMount, Show, batch } from "solid-js";
import { useParams } from "@solidjs/router";
import type { TeamPageResponse } from "../types";
import * as api from "../api";
import AdminSchedule from "../components/admin/Schedule";
import AdminPlayers from "../components/admin/Players";
import AdminManage from "../components/admin/Manage";
import DefaultSquads from "../components/admin/DefaultSquads";

export default function Admin() {
  const params = useParams<{ key: string; secret: string }>();
  const [data, setData] = createSignal<TeamPageResponse | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const d = await api.getAdmin(params.key, params.secret);
      setData(d);
      document.title = `nextgame / admin / ${d.team_name}`;
    } catch (e: any) {
      setError(e.message || "Failed to load admin");
    }
  });

  const refresh = async () => {
    try {
      const d = await api.getAdmin(params.key, params.secret);
      setData(d);
    } catch {}
  };

  return (
    <div class="min-h-screen mesh-bg pb-20">
      <header class="border-b border-white/10 mb-12">
        <div class="max-w-2xl mx-auto px-6 py-6 space-y-1">
          <div class="flex items-center gap-2 mb-1">
            <a href="/" class="text-sm font-brand font-normal text-slate-500 hover:text-[var(--accent-cyan)] transition-colors lowercase tracking-widest">nextgame</a>
            <span class="text-slate-500 text-sm">/</span>
            <span class="text-sm font-brand font-normal text-slate-500 lowercase tracking-widest">admin</span>
            <span class="text-slate-500 text-sm">/</span>
          </div>
          <Show when={data()}>
            {(d) => {
              const [editing, setEditing] = createSignal(false);
              const [editName, setEditName] = createSignal(d().team_name);

              const saveName = async () => {
                const name = editName().trim();
                if (!name || name === d().team_name) {
                  setEditing(false);
                  return;
                }
                try {
                  const updated = await api.updateSettings(params.key, params.secret, { name });
                  batch(() => {
                    setData(updated);
                    setEditing(false);
                  });
                  document.title = `nextgame / admin / ${updated.team_name}`;
                } catch {}
              };

              return (
                <Show when={editing()} fallback={
                  <h1
                    class="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight cursor-pointer group flex items-center gap-3"
                    onClick={() => { setEditName(d().team_name); setEditing(true); }}
                    title="Click to rename"
                  >
                    {d().team_name.split(" ").length > 1
                      ? <>{d().team_name.split(" ").slice(0, -1).join(" ")}{" "}<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{d().team_name.split(" ").at(-1)}</span></>
                      : <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{d().team_name}</span>
                    }
                    <i class="ph ph-pencil-simple text-slate-600 text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h1>
                }>
                  <form
                    class="flex items-center gap-3"
                    onSubmit={(e) => { e.preventDefault(); saveName(); }}
                  >
                    <input
                      ref={(el) => setTimeout(() => el.focus(), 0)}
                      type="text"
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
                      class="glass-input rounded-xl px-4 py-2 text-3xl md:text-4xl font-bold text-white w-full outline-none focus:border-[var(--accent-cyan)]"
                    />
                    <button type="submit" class="text-[var(--accent-turquoise)] hover:text-white transition-colors">
                      <i class="ph ph-check text-2xl" />
                    </button>
                    <button type="button" onClick={() => setEditing(false)} class="text-slate-500 hover:text-white transition-colors">
                      <i class="ph ph-x text-2xl" />
                    </button>
                  </form>
                </Show>
              );
            }}
          </Show>
        </div>
      </header>

      <main class="max-w-2xl mx-auto px-6">
        <Show when={error()}>
          <div class="glass-card rounded-3xl p-8 text-center">
            <p class="text-[var(--accent-danger)]">{error()}</p>
          </div>
        </Show>

        <Show when={data()}>
          {(d) => (
            <div class="space-y-8">
              <AdminManage
                teamKey={params.key}
                teamSecret={params.secret}
                isGameOff={d().game?.is_game_off ?? false}
                onRefresh={refresh}
              />
              <AdminSchedule
                teamKey={params.key}
                teamSecret={params.secret}
                data={d()}
                onSaved={setData}
              />
              <AdminPlayers
                teamKey={params.key}
                teamSecret={params.secret}
                data={d()}
                onRefresh={refresh}
              />
              <DefaultSquads
                teamKey={params.key}
                teamSecret={params.secret}
                defaultSquads={d().default_squads}
                onRefresh={refresh}
              />
            </div>
          )}
        </Show>
      </main>
    </div>
  );
}
