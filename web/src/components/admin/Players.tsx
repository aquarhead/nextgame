import { createSignal, For, createMemo } from "solid-js";
import type { TeamPageResponse } from "../../types";
import * as api from "../../api";

interface Props {
  teamKey: string;
  teamSecret: string;
  data: TeamPageResponse;
  onRefresh: () => void;
}

export default function AdminPlayers(props: Props) {
  const [loading, setLoading] = createSignal(false);
  const [names, setNames] = createSignal("");

  const sortedPlayers = createMemo(() =>
    Object.entries(props.data.players)
      .sort(([, a], [, b]) => a.localeCompare(b))
  );

  const addPlayers = async (e: Event) => {
    e.preventDefault();
    if (!names().trim()) return;
    setLoading(true);
    try {
      await api.adminAddPlayers(props.teamKey, props.teamSecret, names());
      setNames("");
      props.onRefresh();
    } catch { }
    setLoading(false);
  };

  const deletePlayer = async (playerId: string) => {
    try {
      await api.adminDeletePlayer(props.teamKey, props.teamSecret, playerId);
      props.onRefresh();
    } catch { }
  };

  return (
    <div class="glass-card p-8 rounded-[2.5rem] space-y-6">
      <div class="flex items-center gap-3 border-b border-white/10 pb-4">
        <i class="ph ph-users text-2xl text-[var(--accent-turquoise)]" />
        <h2 class="text-2xl font-bold">Players</h2>
      </div>

      <form onSubmit={addPlayers} class="flex gap-3">
        <div class="flex-1 relative">
          <i class="ph ph-user-plus absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={names()}
            onInput={(e) => setNames(e.currentTarget.value)}
            placeholder="Player name (use comma for multiple)"
            class="w-full glass-input rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-turquoise)]/50 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading()}
          class="px-8 py-4 bg-[var(--accent-turquoise)] hover:brightness-110 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div class="overflow-hidden rounded-2xl border border-white/10">
        <table class="w-full text-left">
          <thead class="bg-white/5">
            <tr class="text-xs font-bold text-slate-500 uppercase tracking-widest">
              <th class="px-6 py-4">Player Name</th>
              <th class="px-6 py-4 text-right">Manage</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <For each={sortedPlayers()}>
              {([pid, name]) => (
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold text-[var(--accent-cyan)]">
                        {name.charAt(0)}
                      </div>
                      <span class="font-medium">{name}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button
                      onClick={() => deletePlayer(pid)}
                      class="p-2 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 hover:text-rose-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <i class="ph ph-trash" />
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
