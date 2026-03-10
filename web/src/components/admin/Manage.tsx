import { createSignal } from "solid-js";
import * as api from "../../api";

interface Props {
  teamKey: string;
  teamSecret: string;
  isGameOff: boolean;
  onRefresh: () => void;
}

export default function AdminControls(props: Props) {
  const [loading, setLoading] = createSignal(false);

  const resetGame = async () => {
    setLoading(true);
    try {
      await api.adminResetGame(props.teamKey, props.teamSecret);
      props.onRefresh();
    } catch { }
    setLoading(false);
  };

  const toggleGameOff = async () => {
    try {
      await api.adminToggleGameOff(props.teamKey, props.teamSecret);
      props.onRefresh();
    } catch { }
  };

  return (
    <div class="glass-card p-8 rounded-[2.5rem] space-y-6">
      <div class="flex items-center gap-3 border-b border-white/10 pb-4">
        <i class="ph ph-lightning text-2xl text-[var(--accent-warning)]" />
        <h2 class="text-2xl font-bold">Manage nextgame</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href={`/team/${props.teamKey}`}
          class="flex flex-col items-center gap-3 p-5 bg-[var(--accent-turquoise)]/10 hover:bg-[var(--accent-turquoise)]/20 border border-[var(--accent-turquoise)]/30 rounded-3xl transition-all text-center"
        >
          <div class="w-12 h-12 bg-[var(--accent-turquoise)] rounded-2xl flex items-center justify-center text-black shadow-lg">
            <i class="ph ph-arrow-square-out text-xl" />
          </div>
          <span class="font-bold text-white text-sm">Open nextgame!</span>
        </a>

        <button
          onClick={toggleGameOff}
          class={`flex flex-col items-center gap-3 p-5 rounded-3xl transition-all text-center w-full ${
            props.isGameOff
              ? "bg-[var(--accent-turquoise)]/10 hover:bg-[var(--accent-turquoise)]/20 border border-[var(--accent-turquoise)]/30"
              : "bg-[var(--accent-danger)]/10 hover:bg-[var(--accent-danger)]/20 border border-[var(--accent-danger)]/30"
          }`}
        >
          <div class={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
            props.isGameOff ? "bg-[var(--accent-turquoise)] text-black" : "bg-[var(--accent-danger)] text-white"
          }`}>
            <i class={`ph ${props.isGameOff ? "ph-calendar-check" : "ph-calendar-x"} text-xl`} />
          </div>
          <span class="font-bold text-white text-sm">
            {props.isGameOff ? "Game is On!" : "Mark Off Game"}
          </span>
        </button>

        <button
          onClick={resetGame}
          disabled={loading()}
          class="flex flex-col items-center gap-3 p-5 bg-[var(--accent-danger)]/10 hover:bg-[var(--accent-danger)]/20 border border-[var(--accent-danger)]/30 rounded-3xl transition-all text-center w-full disabled:opacity-50"
        >
          <div class="w-12 h-12 bg-[var(--accent-danger)] rounded-2xl flex items-center justify-center text-white shadow-lg">
            <i class="ph ph-arrows-clockwise text-xl" />
          </div>
          <span class="font-bold text-white text-sm">Reset</span>
        </button>
      </div>
    </div>
  );
}
