import type { TeamPageResponse, NewTeamResponse, Game, Comment } from "./types";

function apiBase(): string {
  const origin = window.location.origin;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return "http://localhost:8787";
  }
  return "https://nextgame.aquarhead.workers.dev";
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function putJsonNoContent(url: string, body: unknown): Promise<void> {
  const resp = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
}

async function deleteNoContent(url: string): Promise<void> {
  const resp = await fetch(url, { method: "DELETE" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
}

async function postNoContent(url: string): Promise<void> {
  const resp = await fetch(url, { method: "POST" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
}

// --- Public API ---

export async function createTeam(name: string): Promise<NewTeamResponse> {
  return postJson(`${apiBase()}/api/teams`, { name });
}

export async function getTeam(key: string): Promise<TeamPageResponse> {
  return fetchJson(`${apiBase()}/api/teams/${key}`);
}

export async function playerPlay(teamKey: string, playerId: string): Promise<void> {
  return postNoContent(`${apiBase()}/api/teams/${teamKey}/players/${playerId}/play`);
}

export async function playerNotPlay(teamKey: string, playerId: string): Promise<void> {
  return postNoContent(`${apiBase()}/api/teams/${teamKey}/players/${playerId}/not_play`);
}

export async function addComment(teamKey: string, comment: string, author?: string): Promise<Comment[]> {
  return postJson(`${apiBase()}/api/teams/${teamKey}/comments`, { comment, author });
}

export async function addGuest(teamKey: string, guestName: string): Promise<string[]> {
  return postJson(`${apiBase()}/api/teams/${teamKey}/guests`, { guest_name: guestName });
}

export async function deleteGuest(teamKey: string, idx: number): Promise<void> {
  return deleteNoContent(`${apiBase()}/api/teams/${teamKey}/guests/${idx}`);
}

export async function createGame(teamKey: string, description: string): Promise<Game> {
  return postJson(`${apiBase()}/api/teams/${teamKey}/new_game`, { description });
}

export async function saveSquads(teamKey: string, squads: Record<string, string>, assignments: Record<string, string>): Promise<void> {
  return putJsonNoContent(`${apiBase()}/api/teams/${teamKey}/squads`, { squads, assignments });
}

// --- Admin API ---

export async function getAdmin(teamKey: string, teamSecret: string): Promise<TeamPageResponse> {
  return fetchJson(`${apiBase()}/api/admin/${teamKey}/${teamSecret}`);
}

export async function updateSettings(teamKey: string, teamSecret: string, body: unknown): Promise<TeamPageResponse> {
  const resp = await fetch(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function adminAddPlayers(teamKey: string, teamSecret: string, names: string): Promise<Record<string, string>> {
  return postJson(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/players`, { names });
}

export async function adminDeletePlayer(teamKey: string, teamSecret: string, playerId: string): Promise<void> {
  return deleteNoContent(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/players/${playerId}`);
}

export async function adminResetGame(teamKey: string, teamSecret: string): Promise<void> {
  return postNoContent(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/reset_game`);
}

export async function adminToggleGameOff(teamKey: string, teamSecret: string): Promise<void> {
  return postNoContent(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/game_off`);
}

export async function adminSetDefaultSquads(teamKey: string, teamSecret: string, squads: Record<string, string>): Promise<void> {
  return putJsonNoContent(`${apiBase()}/api/admin/${teamKey}/${teamSecret}/default_squads`, { squads });
}
