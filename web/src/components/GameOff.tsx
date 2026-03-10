export default function GameOff() {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
      <div class="max-w-md w-full glass-card p-12 rounded-[3rem] text-center space-y-6">
        <div class="relative inline-flex items-center justify-center p-8 rounded-[3rem] glass-card border-rose-500/40 shadow-rose-900/20">
          <i class="ph ph-calendar-x text-8xl text-rose-500" />
        </div>
        <h2 class="text-4xl font-bold">Game is Cancelled</h2>
        <p class="text-slate-400">This game session has been called off. See you next week!</p>
      </div>
    </div>
  );
}
