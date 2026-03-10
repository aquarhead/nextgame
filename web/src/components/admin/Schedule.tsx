import { createSignal, Show } from "solid-js";
import type { TeamPageResponse } from "../../types";
import * as api from "../../api";

interface Props {
  teamKey: string;
  teamSecret: string;
  data: TeamPageResponse;
  onSaved: (d: TeamPageResponse) => void;
}

const WEEKDAYS = [
  { val: 1, label: "Monday" },
  { val: 2, label: "Tuesday" },
  { val: 3, label: "Wednesday" },
  { val: 4, label: "Thursday" },
  { val: 5, label: "Friday" },
  { val: 6, label: "Saturday" },
  { val: 7, label: "Sunday" },
];

export default function AdminSettings(props: Props) {
  const [loading, setLoading] = createSignal(false);
  const [enabled, setEnabled] = createSignal(props.data.weekly_schedule != null);
  const [location, setLocation] = createSignal(props.data.location ?? "");
  const [time, setTime] = createSignal(props.data.time ?? "");
  const [schedule, setSchedule] = createSignal(props.data.weekly_schedule?.toString() ?? "");
  const [showConfirm, setShowConfirm] = createSignal(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        location: location(),
        time: time(),
      };
      const w = parseInt(schedule());
      if (!isNaN(w)) body.weekly_schedule = w;

      const d = await api.updateSettings(props.teamKey, props.teamSecret, body);
      props.onSaved(d);
    } catch { }
    setLoading(false);
  };

  const handleToggle = () => {
    if (enabled()) {
      setShowConfirm(true);
    } else {
      setEnabled(true);
    }
  };

  const confirmDisable = async () => {
    setShowConfirm(false);
    setEnabled(false);
    try {
      const d = await api.updateSettings(props.teamKey, props.teamSecret, {
        weekly_schedule: null,
        location: "",
        time: "",
      });
      setLocation("");
      setTime("");
      setSchedule("");
      props.onSaved(d);
    } catch { }
  };

  return (
    <>
      <div class="glass-card p-8 rounded-[2.5rem] space-y-6">
        <div class="flex items-center justify-between border-b border-white/10 pb-4">
          <div class="flex items-center gap-3">
            <i class="ph ph-calendar-blank text-2xl text-[var(--accent-cyan)]" />
            <h2 class="text-2xl font-bold">Weekly Schedule</h2>
          </div>
          <button
            onClick={handleToggle}
            class={`relative w-12 h-7 rounded-full transition-colors ${enabled() ? "bg-[var(--accent-cyan)]" : "bg-white/15"}`}
          >
            <span class={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled() ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <p class="text-sm text-slate-400">
          Set a weekly schedule, game will be reset automatically after the game day.
        </p>

        <Show when={enabled()}>
          <form onSubmit={submit} class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-2">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Location</label>
                <div class="relative">
                  <i class="ph ph-map-pin absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={location()}
                    onInput={(e) => setLocation(e.currentTarget.value)}
                    class="w-full glass-input rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all"
                  />
                </div>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Time</label>
                <div class="relative">
                  <i class="ph ph-clock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={time()}
                    onInput={(e) => setTime(e.currentTarget.value)}
                    placeholder="e.g. 12:00"
                    class="w-full glass-input rounded-2xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Day of Week</label>
              <div class="relative">
                <i class="ph ph-calendar-blank absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={schedule()}
                  onChange={(e) => setSchedule(e.currentTarget.value)}
                  class="w-full glass-input rounded-2xl pl-12 pr-4 py-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/50 transition-all cursor-pointer"
                >
                  <option value="">Select a day</option>
                  {WEEKDAYS.map((d) => (
                    <option value={d.val.toString()}>{d.label}</option>
                  ))}
                </select>
                <i class="ph ph-caret-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading()}
              class="w-full py-4 bg-[var(--accent-submit)] hover:brightness-110 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading() ? "Saving..." : "Save"}
            </button>
          </form>
        </Show>
      </div>

      {/* Confirmation dialog */}
      <Show when={showConfirm()}>
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div class="glass-card rounded-3xl p-8 max-w-sm w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div class="space-y-2">
              <h3 class="text-xl font-bold">Disable Weekly Schedule?</h3>
              <p class="text-sm text-slate-400">This will clear the schedule, location, and time settings.</p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                class="flex-1 py-3 bg-white/10 hover:bg-white/15 rounded-2xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisable}
                class="flex-1 py-3 bg-[var(--accent-danger)] hover:brightness-110 rounded-2xl font-bold transition-all"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
