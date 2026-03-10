import { createSignal, For, createMemo } from "solid-js";
import type { SquadID } from "../../types";
import * as api from "../../api";

interface Props {
  teamKey: string;
  teamSecret: string;
  defaultSquads: Record<SquadID, string>;
  onRefresh: () => void;
}

export default function DefaultSquads(props: Props) {
  const [loading, setLoading] = createSignal(false);
  const [newName, setNewName] = createSignal("");

  const squads = createMemo(() =>
    Object.entries(props.defaultSquads).sort(([, a], [, b]) => a.localeCompare(b))
  );

  const save = async (updated: Record<SquadID, string>) => {
    setLoading(true);
    try {
      await api.adminSetDefaultSquads(props.teamKey, props.teamSecret, updated);
      props.onRefresh();
    } catch {}
    setLoading(false);
  };

  const addSquad = async (e: Event) => {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    const id = crypto.randomUUID().slice(0, 8);
    const updated = { ...props.defaultSquads, [id]: name };
    setNewName("");
    await save(updated);
  };

  const removeSquad = async (id: string) => {
    const updated = { ...props.defaultSquads };
    delete updated[id];
    await save(updated);
  };

  return (
    <div class="glass-card p-8 rounded-[2.5rem] space-y-6">
      <div class="flex items-center gap-3 border-b border-white/10 pb-4">
        <i class="ph ph-squares-four text-2xl text-[var(--accent-cyan)]" />
        <h2 class="text-2xl font-bold">Default Squads</h2>
      </div>

      <p class="text-sm text-slate-400">
        Create some squads to assign players, each game can further create more squads if necessary.
      </p>

      <form onSubmit={addSquad} class="flex gap-3">
        <div class="flex-1 relative">
          <i class="ph ph-plus-circle absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            placeholder="Squad name"
            class="w-full glass-input rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading()}
          class="px-8 py-4 bg-[var(--accent-cyan)] hover:brightness-110 text-black font-bold rounded-2xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div class="flex flex-wrap gap-3">
        <For each={squads()}>
          {([id, name]) => (
            <div class="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
              <span class="font-medium">{name}</span>
              <button
                onClick={() => removeSquad(id)}
                disabled={loading()}
                class="p-1.5 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 hover:text-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <i class="ph ph-trash text-sm" />
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
