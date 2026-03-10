import { createSignal, Show, For, onCleanup } from "solid-js";

interface Props {
  guests: string[];
  onAdd: (name: string) => void;
  onDelete: (idx: number) => void;
}

export default function GuestForm(props: Props) {
  const [editing, setEditing] = createSignal(false);
  const [guestName, setGuestName] = createSignal("");
  let inputRef!: HTMLInputElement;
  let editingRef!: HTMLSpanElement;

  const submit = () => {
    const name = guestName().trim();
    if (!name) return;
    props.onAdd(name);
    setGuestName("");
    inputRef?.focus();
  };

  const stopEditing = () => { setEditing(false); setGuestName(""); };

  const handleClickOutside = (e: MouseEvent) => {
    if (editing() && editingRef && !editingRef.contains(e.target as Node)) {
      stopEditing();
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  const startEditing = () => {
    setEditing(true);
    setTimeout(() => inputRef?.focus(), 0);
  };

  return (
    <div class="mt-8">
      <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Guest Players</h3>
      <div class="flex flex-wrap gap-2 items-center">
        <For each={props.guests}>
          {(name, idx) => (
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-sm font-medium text-slate-100">
              {name}
              <button
                onClick={() => props.onDelete(idx())}
                class="p-0.5 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30 hover:text-rose-200 rounded transition-colors cursor-pointer"
              >
                <i class="ph ph-trash text-xs" />
              </button>
            </span>
          )}
        </For>

        <Show when={editing()} fallback={
          <button
            onClick={startEditing}
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-white/20 hover:border-[var(--accent-cyan)] text-sm text-slate-400 hover:text-[var(--accent-cyan)] transition-colors"
          >
            <i class="ph ph-plus" />
            Add
          </button>
        }>
          <span ref={editingRef} class="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/5 overflow-hidden">
            <input
              ref={inputRef}
              type="text"
              value={guestName()}
              onInput={(e) => setGuestName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") stopEditing();
              }}
              placeholder="Name"
              class="bg-transparent px-3 py-1.5 text-sm text-white placeholder-slate-400 outline-none w-28"
            />
            <button
              onClick={submit}
              class="px-2 py-1.5 text-[var(--accent-cyan)] hover:bg-cyan-500/10 transition-colors"
            >
              <i class="ph ph-check" />
            </button>
            <button
              onClick={stopEditing}
              class="px-2 py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <i class="ph ph-x" />
            </button>
          </span>
        </Show>
      </div>
    </div>
  );
}
