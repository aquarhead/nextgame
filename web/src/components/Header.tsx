import { Show } from "solid-js";

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

function openIcs(teamName: string, teamKey: string, date: string, location?: string | null) {
  // Parse YYYY-MM-DD and subtract 1 day
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const reminderDate = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nextgame//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${reminderDate}`,
    `RRULE:FREQ=WEEKLY`,
    `SUMMARY:Sign up for ${teamName}`,
    `DESCRIPTION:${window.location.origin}/team/${teamKey}`,
  ];
  if (location) {
    lines.push(`LOCATION:${location}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  // Navigate current window — on iOS this triggers the Calendar app prompt
  window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function Header(props: Props) {

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
            <button
              class="flex items-center gap-1.5 hover:text-[var(--accent-cyan)] transition-colors cursor-pointer"
              title="Add weekly reminder to calendar"
              onClick={() => openIcs(props.teamName, props.teamKey, props.date!, props.location)}
            >
              <i class="ph ph-calendar-plus text-slate-500 text-sm" />
              {props.date}
            </button>
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
