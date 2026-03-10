import { createSignal, Show, For, onCleanup } from "solid-js";
import type { Comment } from "../types";

interface Props {
  comments: Comment[];
  onAdd: (comment: string, author?: string) => void;
}

function commentText(c: Comment): string {
  return typeof c === "string" ? c : c.text;
}

function commentAuthor(c: Comment): string | undefined {
  return typeof c === "string" ? undefined : c.author;
}

export default function Comments(props: Props) {
  const [comment, setComment] = createSignal("");
  const [author, setAuthor] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  let formRef!: HTMLDivElement;

  const submit = async (e: Event) => {
    e.preventDefault();
    const text = comment().trim();
    if (!text) return;
    setLoading(true);
    const authorVal = author().trim() || undefined;
    props.onAdd(text, authorVal);
    setComment("");
    setShowForm(false);
    setLoading(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (showForm() && formRef && !formRef.contains(e.target as Node) && !comment().trim()) {
      setShowForm(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  return (
    <div class="glass-card rounded-[2rem] p-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold flex items-center gap-3">
          <i class="ph ph-chat text-[var(--accent-cyan)]" />
          Comments
        </h2>
        <Show when={!showForm()}>
          <button
            onClick={() => setShowForm(true)}
            class="flex items-center gap-2 px-4 py-2 bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 rounded-xl text-sm font-bold transition-all cursor-pointer"
          >
            <i class="ph ph-plus" />
            Post
          </button>
        </Show>
      </div>

      {/* Comment Input */}
      <Show when={showForm()}>
        <div ref={formRef}>
          <form onSubmit={submit} class="space-y-3 mb-6 p-4 bg-white/5 rounded-2xl border border-white/10">
            <textarea
              value={comment()}
              onInput={(e) => setComment(e.currentTarget.value)}
              placeholder="Leave a message for the team..."
              class="w-full h-24 glass-input rounded-xl p-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all resize-none text-sm"
              autofocus
            />
            <div class="flex gap-3">
              <input
                type="text"
                value={author()}
                onInput={(e) => setAuthor(e.currentTarget.value)}
                placeholder="Your name (optional)"
                class="flex-1 glass-input rounded-xl px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm"
              />
              <button
                type="submit"
                disabled={loading()}
                class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-all disabled:opacity-50 shrink-0 text-sm"
              >
                Post
              </button>
            </div>
          </form>
        </div>
      </Show>

      {/* Comment Feed */}
      <div class="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        <Show when={props.comments.length === 0}>
          <div class="text-center py-8 text-slate-500 text-sm italic">
            No comments yet...
          </div>
        </Show>
        <For each={props.comments}>
          {(c) => (
            <div class="glass-card bg-white/5 border-white/10 p-5 rounded-2xl">
              <Show when={commentAuthor(c)}>
                <span class="text-xs font-semibold text-[var(--accent-cyan)] uppercase tracking-wider">
                  {commentAuthor(c)}
                </span>
              </Show>
              <p class="text-sm text-slate-200 leading-relaxed">{commentText(c)}</p>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
