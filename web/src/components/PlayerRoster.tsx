import { Index, createMemo } from "solid-js";
import type { PlayerID } from "../types";

interface Props {
  roster: Record<PlayerID, string>;
  gamePlayers: Record<PlayerID, boolean | null>;
  onPlay: (id: string) => void;
  onNotPlay: (id: string) => void;
}

export default function PlayerRoster(props: Props) {
  const sortedPlayers = createMemo(() => {
    return Object.entries(props.gamePlayers)
      .map(([pid, playing]) => ({
        id: pid,
        name: props.roster[pid] ?? "Unknown",
        playing,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-slate-400 text-sm font-bold uppercase tracking-wider">
              <th class="pb-4 px-2">Name</th>
              <th class="pb-4 px-2 text-right">Playing?</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            <Index each={sortedPlayers()}>
              {(player) => (
                <tr class="group transition-colors hover:bg-white/5">
                  <td class="py-5 px-2">
                    <span class="font-semibold text-lg text-slate-100">{player().name}</span>
                  </td>
                  <td class="py-5 px-2 text-right">
                    <div class="inline-flex p-1 bg-black/30 rounded-xl border border-white/10">
                      <button
                        onClick={() => props.onPlay(player().id)}
                        class={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${player().playing === true
                            ? "bg-cyan-500 text-white shadow-lg"
                            : "text-slate-500 hover:text-slate-300"
                          }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => props.onNotPlay(player().id)}
                        class={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${player().playing === false
                            ? "bg-rose-500/80 text-white shadow-lg"
                            : "text-slate-500 hover:text-slate-300"
                          }`}
                      >
                        No
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Index>
          </tbody>
        </table>
      </div>
    </div>
  );
}
