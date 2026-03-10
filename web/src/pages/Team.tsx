import { createSignal, createMemo, onMount, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import type { TeamPageResponse, Comment } from "../types";
import * as api from "../api";
import Header from "../components/Header";
import PlayerRoster from "../components/PlayerRoster";
import GuestForm from "../components/GuestForm";
import SquadBoard from "../components/SquadBoard";
import Comments from "../components/Comments";
import GameOff from "../components/GameOff";
import NewGameForm from "../components/NewGameForm";
import Description from "../components/Description";

export default function Team() {
  const params = useParams<{ key: string }>();
  const [data, setData] = createSignal<TeamPageResponse | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<"registration" | "squads">("registration");

  // Reactive game state lifted into signals
  const [gamePlayers, setGamePlayers] = createSignal<Record<string, boolean | null>>({});
  const [guests, setGuests] = createSignal<string[]>([]);
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [squads, setSquads] = createSignal<Record<string, string>>({});
  const [squadAssignments, setSquadAssignments] = createSignal<Record<string, string>>({});

  onMount(async () => {
    try {
      const d = await api.getTeam(params.key);
      setData(d);
      document.title = `nextgame / ${d.team_name}`;
      if (d.game) {
        setGamePlayers(d.game.players);
        setGuests(d.game.guests);
        setComments(d.game.comments);
        setSquads(d.game.squads);
        setSquadAssignments(d.game.squad_assignments);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load team");
    }
  });

  const playingCount = createMemo(() =>
    Object.values(gamePlayers()).filter((v) => v === true).length
  );

  const guestCount = createMemo(() => guests().length);

  const handlePlay = async (playerId: string) => {
    try {
      await api.playerPlay(params.key, playerId);
      setGamePlayers((prev) => ({ ...prev, [playerId]: true }));
    } catch { }
  };

  const handleNotPlay = async (playerId: string) => {
    try {
      await api.playerNotPlay(params.key, playerId);
      setGamePlayers((prev) => ({ ...prev, [playerId]: false }));
    } catch { }
  };

  const handleAddComment = async (comment: string, author?: string) => {
    try {
      const newComments = await api.addComment(params.key, comment, author);
      setComments(newComments);
    } catch { }
  };

  const handleAddGuest = async (name: string) => {
    try {
      const newGuests = await api.addGuest(params.key, name);
      setGuests(newGuests);
    } catch { }
  };

  const handleDeleteGuest = async (idx: number) => {
    try {
      await api.deleteGuest(params.key, idx);
      setGuests((prev) => prev.filter((_, i) => i !== idx));
    } catch { }
  };

  const handleSquadDrop = async (squadId: string, playerId: string) => {
    const newAssignments = { ...squadAssignments(), [playerId]: squadId };
    // Remove assignment if dropping to unassigned (empty squadId)
    if (!squadId) delete newAssignments[playerId];
    setSquadAssignments(newAssignments);
    try {
      await api.saveSquads(params.key, squads(), newAssignments);
    } catch { }
  };

  const handleAddSquad = async (name: string) => {
    const id = crypto.randomUUID().slice(0, 8);
    const newSquads = { ...squads(), [id]: name };
    setSquads(newSquads);
    try {
      await api.saveSquads(params.key, newSquads, squadAssignments());
    } catch { }
  };

  const handleDeleteSquad = async (squadId: string) => {
    const newSquads = { ...squads() };
    delete newSquads[squadId];
    // Move players from deleted squad to unassigned
    const newAssignments = { ...squadAssignments() };
    for (const [pid, sid] of Object.entries(newAssignments)) {
      if (sid === squadId) delete newAssignments[pid];
    }
    setSquads(newSquads);
    setSquadAssignments(newAssignments);
    try {
      await api.saveSquads(params.key, newSquads, newAssignments);
    } catch { }
  };

  const handleRandomAssign = async (newAssignments: Record<string, string>) => {
    setSquadAssignments(newAssignments);
    try {
      await api.saveSquads(params.key, squads(), newAssignments);
    } catch { }
  };

  const handleGameCreated = (d: TeamPageResponse) => {
    setData(d);
    if (d.game) {
      setGamePlayers(d.game.players);
      setGuests(d.game.guests);
      setComments(d.game.comments);
      setSquads(d.game.squads);
      setSquadAssignments(d.game.squad_assignments);
    }
  };

  return (
    <div class="min-h-screen mesh-bg text-white selection:bg-cyan-500/30 pb-20">
      {/* Top decoration */}
      <div class="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />

      <div class="max-w-7xl mx-auto px-6 pt-12 relative">
        <Show when={error()}>
          <div class="glass-card rounded-3xl p-8 text-center">
            <p class="text-[var(--accent-danger)]">{error()}</p>
          </div>
        </Show>

        <Show when={data()}>
          {(d) => {
            const game = () => d().game;
            return (
              <>
                <Header
                  teamName={d().team_name}
                  location={d().location}
                  time={d().time}
                  date={game()?.date ?? null}
                  playingCount={playingCount()}
                  guestCount={guestCount()}
                  hasGame={!!game()}
                />

                <Show when={game()?.is_game_off}>
                  <GameOff />
                </Show>

                <Show when={game()} fallback={
                  <NewGameForm teamKey={params.key} onCreated={handleGameCreated} />
                }>
                  {(g) => (
                    <>
                      <main class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Registration & Squads */}
                        <div class="lg:col-span-8 space-y-6">
                          <div class="glass-card rounded-[2rem] overflow-hidden">
                            {/* Tabs Header */}
                            <div class="flex border-b border-white/10 bg-white/5">
                              <button
                                onClick={() => setActiveTab("registration")}
                                class={`flex-1 py-5 px-6 font-semibold flex items-center justify-center gap-3 transition-all outline-none ${activeTab() === "registration"
                                  ? "bg-white/10 text-white"
                                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                  }`}
                              >
                                <i class="ph ph-user-circle-check" />
                                Registration
                              </button>
                              <button
                                onClick={() => setActiveTab("squads")}
                                class={`flex-1 py-5 px-6 font-semibold flex items-center justify-center gap-3 transition-all outline-none ${activeTab() === "squads"
                                  ? "bg-white/10 text-white"
                                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                  }`}
                              >
                                <i class="ph ph-users" />
                                Squad
                              </button>
                            </div>

                            <div class="p-8">
                              <Show when={activeTab() === "registration"}>
                                <PlayerRoster
                                  roster={d().players}
                                  gamePlayers={gamePlayers()}
                                  onPlay={handlePlay}
                                  onNotPlay={handleNotPlay}
                                />
                                <GuestForm
                                  guests={guests()}
                                  onAdd={handleAddGuest}
                                  onDelete={handleDeleteGuest}
                                />
                              </Show>
                              <Show when={activeTab() === "squads"}>
                                <SquadBoard
                                  roster={d().players}
                                  gamePlayers={gamePlayers()}
                                  guests={guests()}
                                  squads={squads()}
                                  assignments={squadAssignments()}
                                  onDrop={handleSquadDrop}
                                  onAddSquad={handleAddSquad}
                                  onDeleteSquad={handleDeleteSquad}
                                  onRandomAssign={handleRandomAssign}
                                />
                              </Show>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Description + Comments */}
                        <aside class="lg:col-span-4 space-y-6">
                          <Show when={g().description}>
                            <Description description={g().description} />
                          </Show>
                          <Comments
                            comments={comments()}
                            onAdd={handleAddComment}
                          />
                        </aside>
                      </main>
                    </>
                  )}
                </Show>
              </>
            );
          }}
        </Show>
      </div>
    </div>
  );
}
