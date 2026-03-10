import { createSignal } from "solid-js";
import type { TeamPageResponse } from "../types";
import * as api from "../api";

interface Props {
  teamKey: string;
  onCreated: (data: TeamPageResponse) => void;
}

export default function NewGameForm(props: Props) {
  const [description, setDescription] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createGame(props.teamKey, description());
      const d = await api.getTeam(props.teamKey);
      props.onCreated(d);
    } catch { }
    setLoading(false);
  };

  return (
    <div class="glass-card rounded-[2.5rem] p-8 mt-8">
      <form onSubmit={submit} class="space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
            Description (optional)
          </label>
          <textarea
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            class="w-full glass-input rounded-2xl p-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all min-h-[80px] resize-none"
            placeholder="Game details..."
          />
        </div>
        <button
          type="submit"
          disabled={loading()}
          class="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:opacity-90 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
        >
          {loading() ? "Creating..." : "Create Game"}
        </button>
      </form>
    </div>
  );
}
