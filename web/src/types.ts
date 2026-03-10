// Mirrors shared/src/lib.rs types

export type PlayerID = string;
export type SquadID = string;

// A comment is either a legacy plain string or an object with optional author.
export type Comment = string | { text: string; author?: string };

export interface Game {
  description: string;
  players: Record<PlayerID, boolean | null>;
  guests: string[];
  comments: Comment[];
  date: string | null;
  squads: Record<SquadID, string>;
  squad_assignments: Record<PlayerID, SquadID>;
  is_game_off: boolean;
}

export interface TeamPageResponse {
  team_name: string;
  team_key: string;
  location: string | null;
  time: string | null;
  weekly_schedule: number | null;
  default_squads: Record<SquadID, string>;
  players: Record<PlayerID, string>;
  game: Game | null;
}

export interface NewTeamResponse {
  team_key: string;
  team_secret: string;
}
