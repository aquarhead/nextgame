import { createSignal, onMount, Show } from "solid-js";
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
            {(d) => (
              <h1 class="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
                {d().team_name.split(" ").length > 1
                  ? <>{d().team_name.split(" ").slice(0, -1).join(" ")}{" "}<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{d().team_name.split(" ").at(-1)}</span></>
                  : <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{d().team_name}</span>
                }
              </h1>
            )}
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
