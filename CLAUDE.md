# nextgame

A web app for sports team game registration, squad assignment, and comments.

## Project Structure

- `api/` — Rust backend on Cloudflare Workers with KV storage
  - `api/src/lib.rs` — main router, CORS, JSON API handlers
  - `api/src/types.rs` — data types (Team, Game, Comment enum, API response types)
  - `api/src/service.rs` — business logic (add_comment, reset_game, etc.)
  - `api/wrangler.toml` — Cloudflare Workers config
  - `api/justfile` — `just dev` runs `pnpm exec wrangler dev`
- `web/` — SolidJS + TypeScript frontend (CSR only)
  - `web/src/pages/` — Home, Team, Admin pages
  - `web/src/components/` — Header, PlayerRoster, Comments, GuestForm, SquadBoard, etc.
  - `web/src/components/admin/` — Schedule, Players, Manage, DefaultSquads
  - `web/src/api.ts` — API client (localhost:8787 for dev, production URL otherwise)
  - `web/src/types.ts` — TypeScript types mirroring Rust types
  - `web/justfile` — `just dev` runs `pnpm dev`, `just build` runs `pnpm build`

## Dev Workflow

- `just dev` (from root) — runs mprocs with both api and web dev servers
- API dev server: `http://localhost:8787`
- Web dev server: `http://localhost:5173`
- No Vite proxy — the web app calls the API directly with conditional origin logic in `api.ts`
- CORS is configured in the API to allow `http://localhost:5173`

## Tech Stack

### API
- Rust, Cloudflare Workers, KV storage
- `worker` crate for Workers runtime
- `serde` with `#[serde(untagged)]` for backwards-compatible Comment enum (legacy strings vs {text, author?} objects)
- `jiff` for date handling (weekly schedule)

### Web
- SolidJS + TypeScript, Vite, pnpm
- Tailwind CSS v4 (`@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS)
- Phosphor Icons (`@phosphor-icons/web` CDN, used as `<i class="ph ph-icon-name" />`)
- Fonts: General Sans (headings), Satoshi (body), Corben (brand) — `font-heading`, `font-body`, `font-brand` in Tailwind theme
- `marked` library for GFM markdown rendering (game description)
- Glassmorphism design: glass-card, glass-input, mesh-bg classes in styles.css
- Kanagawa color theme (single theme, no theme switcher)
- `@solidjs/router` for client-side routing

## Key Design Decisions

- "nextgame" is always lowercase
- Page titles: `nextgame / {team_name}`, `nextgame / admin / {team_name}`
- Brand text uses Corben font (`font-brand`) — home page title, subtitle, breadcrumbs
- Comments support optional author field, backwards-compatible with legacy string format
- Game description renders GFM markdown
- Guest players shown as inline tag pills with trash icon to delete
- Guests included in squad assignment (keyed as `guest:{index}`) with amber "guest" badge
- Playing count info box: only shown when a game exists
  - Desktop: inline with team name in a flex row, whole row sticks
  - Mobile: separate sticky element below team name, full width
- Description box is in the right column alongside Comments (not in header)
- Admin page: single centered column (`max-w-2xl`), non-sticky header
  - Sections: Manage nextgame, Weekly Schedule, Player Management, Default Squads
  - Weekly Schedule has toggle with confirmation dialog on disable
  - Manage nextgame: 3 buttons in row on desktop, stacked on mobile
- Squad tab: drag-and-drop assignment, "Randomly Assign" (only unassigned players, even distribution), inline squad creation/deletion
- Home page: `/?demo` shows dummy result page for testing

## Build & Verify

```sh
cd web && pnpm build    # type-check + vite build
cd api && npx wrangler build  # verify API builds
cd api && cargo test    # run API tests (40 tests)
```

## Routes

### Web (SolidJS Router)
- `/` — Home (create team)
- `/team/:key` — Team page (registration, squads, comments)
- `/admin/:key/:secret` — Admin dashboard

### API
- `POST /api/teams` — create team
- `GET /api/teams/:key` — team page data
- `POST /api/teams/:key/players/:pid/play` — mark playing
- `POST /api/teams/:key/players/:pid/not_play` — mark not playing
- `POST /api/teams/:key/comments` — add comment `{comment, author?}`
- `POST /api/teams/:key/guests` — add guest
- `DELETE /api/teams/:key/guests/:idx` — delete guest
- `POST /api/teams/:key/new_game` — create game
- `PUT /api/teams/:key/squads` — save squad definitions + assignments `{squads, assignments}`
- `GET /api/admin/:key/:secret` — admin data
- `PUT /api/admin/:key/:secret/settings` — update settings (incl. clearing weekly_schedule with null)
- `POST /api/admin/:key/:secret/players` — add players
- `DELETE /api/admin/:key/:secret/players/:pid` — delete player
- `POST /api/admin/:key/:secret/reset_game` — reset game
- `POST /api/admin/:key/:secret/game_off` — toggle game off
- `PUT /api/admin/:key/:secret/default_squads` — set default squads
