import { createMemo } from "solid-js";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

interface Props {
  description: string;
}

export default function Description(props: Props) {
  const html = createMemo(() => marked.parse(props.description) as string);

  return (
    <div class="glass-card rounded-[2rem] p-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center gap-3">
        <i class="ph ph-info text-[var(--accent-cyan)]" />
        About
      </h2>
      <div class="text-sm text-slate-400 prose-description" innerHTML={html()} />
    </div>
  );
}
