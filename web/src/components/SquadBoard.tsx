import { For, Show, createSignal, createMemo, onCleanup } from "solid-js";
import type { PlayerID, SquadID } from "../types";

interface Props {
  roster: Record<PlayerID, string>;
  gamePlayers: Record<PlayerID, boolean | null>;
  guests: string[];
  squads: Record<SquadID, string>;
  assignments: Record<string, SquadID>;
  onDrop: (squadId: string, playerId: string) => void;
  onAddSquad: (name: string) => void;
  onDeleteSquad: (squadId: string) => void;
  onRandomAssign: (assignments: Record<string, string>) => void;
}

const TEAM_COLORS = [
  { border: "border-cyan-500/30", text: "text-cyan-400" },
  { border: "border-emerald-500/30", text: "text-emerald-400" },
  { border: "border-amber-500/30", text: "text-amber-400" },
  { border: "border-rose-500/30", text: "text-rose-400" },
  { border: "border-purple-500/30", text: "text-purple-400" },
];

export default function SquadBoard(props: Props) {
  const [newSquadName, setNewSquadName] = createSignal("");
  const [addingSquad, setAddingSquad] = createSignal(false);
  let addSquadRef!: HTMLDivElement;
  let addSquadInputRef!: HTMLInputElement;

  const startAddingSquad = () => {
    setAddingSquad(true);
    setTimeout(() => addSquadInputRef?.focus(), 0);
  };

  const stopAddingSquad = () => {
    setAddingSquad(false);
    setNewSquadName("");
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (addingSquad() && addSquadRef && !addSquadRef.contains(e.target as Node)) {
      stopAddingSquad();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  // All assignable people: playing players + guests
  const allPeople = createMemo(() => {
    const players = Object.entries(props.gamePlayers)
      .filter(([, playing]) => playing === true)
      .map(([pid]) => ({
        id: pid,
        name: props.roster[pid] ?? "Unknown",
        isGuest: false,
      }));

    const guests = props.guests.map((name, idx) => ({
      id: `guest:${idx}`,
      name,
      isGuest: true,
    }));

    return [...players, ...guests];
  });

  const unassigned = createMemo(() =>
    allPeople().filter((p) => !props.assignments[p.id] || props.assignments[p.id] === "")
  );

  const squadEntries = createMemo(() => Object.entries(props.squads));

  const peopleInSquad = (squadId: string) =>
    allPeople().filter((p) => props.assignments[p.id] === squadId);

  const handleDragStart = (e: DragEvent, playerId: string) => {
    e.dataTransfer?.setData("text/plain", playerId);
    e.dataTransfer!.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add("drag-over");
  };

  const handleDragLeave = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove("drag-over");
  };

  const handleDrop = (e: DragEvent, squadId: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove("drag-over");
    const pid = e.dataTransfer?.getData("text/plain");
    if (pid) props.onDrop(squadId, pid);
  };

  const handleAddSquad = (e?: Event) => {
    e?.preventDefault();
    const name = newSquadName().trim();
    if (!name) return;
    props.onAddSquad(name);
    stopAddingSquad();
  };

  const handleRandomAssign = () => {
    const unassignedPeople = unassigned();
    const squadIds = Object.keys(props.squads);
    if (unassignedPeople.length === 0 || squadIds.length === 0) return;

    // Fisher-Yates shuffle
    const shuffled = [...unassignedPeople];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Count existing assignments per squad for even distribution
    const counts: Record<string, number> = {};
    for (const sid of squadIds) counts[sid] = peopleInSquad(sid).length;

    const newAssignments: Record<string, string> = { ...props.assignments };
    for (const p of shuffled) {
      // Pick squad with fewest members
      const target = squadIds.reduce((a, b) => counts[a] <= counts[b] ? a : b);
      newAssignments[p.id] = target;
      counts[target]++;
    }
    props.onRandomAssign(newAssignments);
  };

  const PersonChip = (p: { id: string; name: string; isGuest: boolean }, inSquad: boolean) => (
    <div
      draggable={true}
      onDragStart={(e) => handleDragStart(e, p.id)}
      class={`${inSquad
        ? "flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl"
        : "px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl shadow-xl flex items-center gap-2"
        } group cursor-grab active:cursor-grabbing transition-all`}
    >
      <i class={`ph ph-dots-six-vertical text-slate-500 ${inSquad ? "group-hover:text-white" : "group-hover:text-[var(--accent-cyan)]"}`} />
      <span class={`text-sm font-bold ${inSquad ? "text-slate-100" : ""}`}>{p.name}</span>
      {p.isGuest && <span class="text-[10px] bg-amber-500/20 text-amber-400 uppercase font-bold px-2 py-0.5 rounded-full">guest</span>}
    </div>
  );

  return (
    <div>
      <div class="mb-8 flex items-center justify-between">
        <p class="text-slate-400">Drag players into their respective squads.</p>
        <Show when={allPeople().length > 0 && squadEntries().length > 0}>
          <button
            onClick={handleRandomAssign}
            class="flex items-center gap-2 px-4 py-2 bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 rounded-xl text-sm font-bold transition-all cursor-pointer"
          >
            <i class="ph ph-shuffle" />
            Randomly Assign
          </button>
        </Show>
      </div>

      <Show when={allPeople().length === 0}>
        <div class="text-center py-8 glass-card rounded-2xl border-dashed mb-8">
          <i class="ph ph-warning-circle text-4xl text-amber-400 mb-4" />
          <p class="text-lg text-slate-300">No players confirmed yet. Go to Registration tab first.</p>
        </div>
      </Show>

      <div class="space-y-8">
        {/* Unassigned Players Tray */}
        <Show when={allPeople().length > 0}>
          <div
            class={`glass-card rounded-2xl bg-white/5 border-white/10 ${unassigned().length > 0 ? "p-4" : "px-4 py-2"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "")}
          >
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest">Unassigned</h3>
            <Show when={unassigned().length > 0}>
              <div class="flex flex-wrap gap-2 mt-3">
                <For each={unassigned()}>
                  {(person) => PersonChip(person, false)}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Squad Drop Zones */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <For each={squadEntries()}>
            {([squadId, squadName], idx) => {
              const colors = TEAM_COLORS[idx() % TEAM_COLORS.length];
              return (
                <div
                  class={`glass-card rounded-3xl overflow-hidden border-2 transition-all min-h-[250px] ${colors.border}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, squadId)}
                >
                  <div class="p-5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <h3 class={`font-bold ${colors.text}`}>{squadName}</h3>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold bg-white/10 px-2 py-1 rounded">
                        {peopleInSquad(squadId).length}
                      </span>
                      <button
                        onClick={() => props.onDeleteSquad(squadId)}
                        class="p-1.5 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 hover:text-rose-200 rounded-lg transition-colors cursor-pointer"
                        title="Delete squad"
                      >
                        <i class="ph ph-trash text-sm" />
                      </button>
                    </div>
                  </div>
                  <div class="p-5 space-y-3">
                    <For each={peopleInSquad(squadId)}>
                      {(person) => PersonChip(person, true)}
                    </For>
                    <Show when={peopleInSquad(squadId).length === 0}>
                      <div class="h-32 flex items-center justify-center border border-dashed border-white/10 rounded-xl text-slate-500 text-xs italic">
                        Drop players here
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>

          {/* Add New Squad */}
          <Show when={addingSquad()} fallback={
            <button
              onClick={startAddingSquad}
              class="rounded-3xl border-2 border-dashed border-white/15 min-h-[250px] flex flex-col items-center justify-center gap-3 p-5 transition-all hover:border-[var(--accent-cyan)]/40 hover:bg-white/5 cursor-pointer w-full"
            >
              <i class="ph ph-plus-circle text-3xl text-slate-500" />
              <span class="text-sm text-slate-500 font-medium">Add Squad</span>
            </button>
          }>
            <div ref={addSquadRef} class="rounded-3xl border-2 border-dashed border-[var(--accent-cyan)]/30 min-h-[250px] flex flex-col items-center justify-center gap-4 p-5">
              <i class="ph ph-plus-circle text-3xl text-[var(--accent-cyan)]" />
              <input
                ref={addSquadInputRef}
                type="text"
                value={newSquadName()}
                onInput={(e) => setNewSquadName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSquad();
                  if (e.key === "Escape") stopAddingSquad();
                }}
                placeholder="Squad name"
                class="w-full glass-input rounded-xl px-4 py-3 text-white text-center placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all text-sm"
              />
              <div class="flex gap-2">
                <button
                  onClick={() => handleAddSquad()}
                  class="px-5 py-2 bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  Add
                </button>
                <button
                  onClick={stopAddingSquad}
                  class="px-5 py-2 bg-white/5 text-slate-400 hover:bg-white/10 rounded-xl text-sm font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
