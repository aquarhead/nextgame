use std::collections::HashMap;

use jiff::civil::Date;
use serde::{Deserialize, Serialize};

pub type PlayerID = String;
pub type SquadID = String;

#[derive(Serialize, Deserialize, Debug)]
pub struct Team {
    pub name: String,
    pub secret: String,
    pub next_game: Option<String>,
    pub players: HashMap<PlayerID, String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub time: Option<String>,
    #[serde(default)]
    pub weekly_schedule: Option<i8>,
    #[serde(default)]
    pub default_squads: HashMap<SquadID, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Game {
    pub description: String,
    pub players: HashMap<PlayerID, Option<bool>>,
    pub guests: Vec<String>,
    #[serde(default)]
    pub comments: Vec<Comment>,
    #[serde(default)]
    pub date: Option<Date>,
    #[serde(default)]
    pub squads: HashMap<SquadID, String>,
    #[serde(default)]
    pub squad_assignments: HashMap<PlayerID, SquadID>,
    #[serde(default)]
    pub is_game_off: bool,
}

/// A comment is either a legacy plain string or a struct with optional author.
/// Old data stored as strings will deserialize via the Legacy variant.
/// New comments are always saved as Full.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum Comment {
    Full { text: String, #[serde(default, skip_serializing_if = "Option::is_none")] author: Option<String> },
    Legacy(String),
}

// API response types

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TeamPageResponse {
    pub team_name: String,
    pub team_key: String,
    pub location: Option<String>,
    pub time: Option<String>,
    pub weekly_schedule: Option<i8>,
    pub default_squads: HashMap<SquadID, String>,
    pub players: HashMap<PlayerID, String>,
    pub game: Option<Game>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NewTeamResponse {
    pub team_key: String,
    pub team_secret: String,
}
