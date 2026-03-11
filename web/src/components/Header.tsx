import { Show, createSignal, onMount } from "solid-js";

interface Props {
  teamName: string;
  teamKey: string;
  location: string | null;
  time: string | null;
  date: string | null;
  playingCount: number;
  guestCount: number;
  hasGame: boolean;
}

function reminderUrl(teamKey: string): string {
  const origin = window.location.origin;
  const base = (origin.includes("localhost") || origin.includes("127.0.0.1"))
    ? "http://localhost:8787"
    : "https://nextgame.aquarhead.workers.dev";
  return `${base}/api/teams/${teamKey}/reminder.ics`;
}

const HINT_KEY = "nextgame_reminder_hint_dismissed";

export default function Header(props: Props) {
  const [showHint, setShowHint] = createSignal(false);

  onMount(() => {
    if (props.date && !localStorage.getItem(HINT_KEY)) {
      const timer = setTimeout(() => setShowHint(true), 1200);
      return () => clearTimeout(timer);
    }
  });

  const dismissHint = () => {
    localStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
  };

  const infoBox = () => (
    <div class="glass-card px-5 py-3 rounded-3xl flex items-center gap-4 border-l-4 border-l-cyan-500 shrink-0">
      <div class="flex flex-col">
        <span class="text-2xl font-bold text-white">{props.playingCount + props.guestCount} playing!</span>
        <Show when={props.guestCount > 0}>
          <span class="text-[10px] text-[var(--accent-cyan)] font-bold uppercase tracking-wider">
            including {props.guestCount} guests
          </span>
        </Show>
      </div>
      <Show when={props.location || props.date || props.time}>
        <div class="w-px h-10 bg-white/15" />
        <div class="flex flex-col gap-0.5 text-slate-400 text-sm font-medium">
          <Show when={props.location}>
            <span class="flex items-center gap-1.5">
              <i class="ph ph-map-pin text-slate-500 text-sm" />
              {props.location}
            </span>
          </Show>
          <Show when={props.date}>
            <div class="relative">
              <a
                href={reminderUrl(props.teamKey)}
                class="flex items-center gap-1.5 hover:text-[var(--accent-cyan)] transition-colors"
                title="Add weekly reminder to calendar"
                onClick={dismissHint}
              >
                <i class="ph ph-calendar-plus text-slate-500 text-sm" />
                {props.date}
              </a>
              <Show when={showHint()}>
                <div class="hint-popup absolute left-1/2 top-full mt-3 z-50" onClick={dismissHint}>
                  <div class="hint-arrow" />
                  <div class="glass-card rounded-xl px-4 py-2.5 text-xs text-white whitespace-nowrap shadow-lg shadow-black/30 border-[var(--accent-cyan)]/30">
                    <span class="flex items-center gap-2">
                      <i class="ph ph-bell-ringing text-[var(--accent-cyan)] text-sm hint-wiggle" />
                      click to setup a weekly reminder!
                    </span>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
          <Show when={props.time}>
            <span class="flex items-center gap-1.5">
              <i class="ph ph-clock text-slate-500 text-sm" />
              {props.time}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );

  const teamNameEl = () => (
    props.teamName.split(" ").length > 1
      ? <>{props.teamName.split(" ").slice(0, -1).join(" ")}{" "}<span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{props.teamName.split(" ").at(-1)}</span></>
      : <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{props.teamName}</span>
  );

  return (
    <>
      {/* Breadcrumb - always scrolls away */}
      <div class="flex items-center gap-2 mb-1 pt-6">
        <a href="/" class="text-sm font-brand font-normal text-slate-500 hover:text-[var(--accent-cyan)] transition-colors lowercase tracking-widest">nextgame</a>
        <span class="text-slate-500 text-sm">/</span>
      </div>

      <Show when={props.hasGame} fallback={
        <h1 class="text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight mb-8">
          {teamNameEl()}
        </h1>
      }>
        {/* Desktop: sticky row with team name + info box */}
        <div class="hidden md:sticky md:top-0 md:z-40 md:flex items-center gap-4 py-3 backdrop-blur-xl mb-4">
          <h1 class="text-6xl font-bold tracking-tight text-white leading-tight shrink-0">
            {teamNameEl()}
          </h1>
          {infoBox()}
        </div>

        {/* Mobile: team name scrolls away */}
        <h1 class="md:hidden text-5xl font-bold tracking-tight text-white leading-tight mb-4">
          {teamNameEl()}
        </h1>

        {/* Mobile: sticky info box */}
        <div class="md:hidden sticky top-0 z-40 py-3 backdrop-blur-xl mb-8">
          {infoBox()}
        </div>
      </Show>
    </>
  );
}
