import { Router, Route } from "@solidjs/router";
import Home from "./pages/Home";
import Team from "./pages/Team";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <div class="min-h-screen mesh-bg text-white selection:bg-cyan-500/30">
      <Router>
        <Route path="/" component={Home} />
        <Route path="/team/:key" component={Team} />
        <Route path="/admin/:key/:secret" component={Admin} />
        <Route path="*" component={() => (
          <div class="flex items-center justify-center min-h-screen">
            <div class="glass-card rounded-3xl p-8 text-center">
              <h1 class="text-2xl font-heading font-bold mb-2">Page not found</h1>
              <a href="/" class="text-[var(--accent-cyan)] hover:underline">Go home</a>
            </div>
          </div>
        )} />
      </Router>
      <footer class="text-center text-xs text-slate-500 py-4 space-x-2">
        <span>Support this project by <a href="https://www.icesar.com/en/support-us" target="_blank" rel="noopener" class="underline hover:text-slate-300">donating to ICE-SAR</a></span>
        <span>&middot;</span>
        <a href="https://github.com/aquarhead/nextgame" target="_blank" rel="noopener" class="underline hover:text-slate-300">FOSS</a>
        <span>forever</span>
        <span>&middot;</span>
        <a href="https://github.com/aquarhead/nextgame/wiki/How%E2%80%90to" target="_blank" rel="noopener" class="underline hover:text-slate-300">RTFM</a>
      </footer>
    </div>
  );
}
