use std::collections::HashMap;

use serde::Serialize;
use worker::*;

mod random;
mod service;
mod types;

use types::{Game, NewTeamResponse, Team};

const UI_DOMAIN: &str = "https://nextgame.aqd.is";

const ALLOWED_ORIGINS: &[&str] = &[
    UI_DOMAIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

fn cors_origin(req: &Request) -> String {
    req.headers()
        .get("Origin")
        .ok()
        .flatten()
        .filter(|o| ALLOWED_ORIGINS.contains(&o.as_str()))
        .unwrap_or_else(|| UI_DOMAIN.to_string())
}

fn cors_headers(origin: &str) -> Headers {
    let headers = Headers::new();
    let _ = headers.set("Access-Control-Allow-Origin", origin);
    let _ = headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    let _ = headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers
}

fn json_response<T: Serialize>(data: &T, origin: &str) -> Result<Response> {
    let body = serde_json::to_string(data).unwrap();
    let mut resp = Response::from_bytes(body.into_bytes())?;
    let headers = resp.headers_mut();
    let cors = cors_headers(origin);
    for (k, v) in cors.entries() {
        let _ = headers.set(&k, &v);
    }
    let _ = headers.set("Content-Type", "application/json");
    Ok(resp)
}

fn no_content_response(origin: &str) -> Result<Response> {
    let mut resp = Response::empty()?.with_status(204);
    let headers = resp.headers_mut();
    let cors = cors_headers(origin);
    for (k, v) in cors.entries() {
        let _ = headers.set(&k, &v);
    }
    Ok(resp)
}

fn error_json(msg: &str, status: u16, origin: &str) -> Result<Response> {
    let body = serde_json::json!({"error": msg}).to_string();
    let mut resp = Response::from_bytes(body.into_bytes())?.with_status(status);
    let headers = resp.headers_mut();
    let cors = cors_headers(origin);
    for (k, v) in cors.entries() {
        let _ = headers.set(&k, &v);
    }
    let _ = headers.set("Content-Type", "application/json");
    Ok(resp)
}

fn redirect_to_ui(path: &str) -> Result<Response> {
    let url = format!("{}{}", UI_DOMAIN, path);
    let mut resp = Response::empty()?.with_status(301);
    let headers = resp.headers_mut();
    let _ = headers.set("Location", &url);
    Ok(resp)
}

// --- Helper: get team from KV ---
async fn get_team(ctx: &RouteContext<()>) -> Result<Option<Team>> {
    let key = ctx.param("teamkey").unwrap();
    let t = ctx.kv("teams")?.get(key).text().await?;
    Ok(t.map(|t| serde_json::from_str(&t).unwrap()))
}

// --- Helper: get team with auth ---
async fn get_team_authed(ctx: &RouteContext<()>) -> Result<Option<Team>> {
    let secret = ctx.param("teamsecret").unwrap();
    let team = get_team(ctx).await?;
    match team {
        Some(t) if t.secret == *secret => Ok(Some(t)),
        _ => Ok(None),
    }
}

// --- Helper: get game from team ---
async fn get_game(ctx: &RouteContext<()>, team: &Team) -> Result<Option<Game>> {
    if let Some(ng_key) = &team.next_game {
        let g = ctx.kv("games")?.get(ng_key).text().await?;
        Ok(g.map(|g| serde_json::from_str(&g).unwrap()))
    } else {
        Ok(None)
    }
}

// ============================================================
// Router
// ============================================================

#[event(fetch)]
async fn main(req: Request, env: Env, _: Context) -> Result<Response> {
    console_error_panic_hook::set_once();

    let router = Router::new();

    router
        // --- Old HTML routes -> redirect to UI ---
        .get_async("/", html_home_redirect)
        .get_async("/team/:teamkey", html_team_redirect)
        .get_async("/admin/:teamkey/:teamsecret", html_admin_redirect)
        // --- CORS preflight ---
        .options_async("/api/*catchall", api_options)
        // --- API: teams ---
        .post_async("/api/teams", api_new_team)
        .get_async("/api/teams/:teamkey", api_team)
        .post_async("/api/teams/:teamkey/players/:playerid/play", api_play)
        .post_async("/api/teams/:teamkey/players/:playerid/not_play", api_not_play)
        .post_async("/api/teams/:teamkey/comments", api_add_comment)
        .post_async("/api/teams/:teamkey/guests", api_add_guest)
        .delete_async("/api/teams/:teamkey/guests/:idx", api_delete_guest)
        .post_async("/api/teams/:teamkey/new_game", api_new_game)
        .put_async("/api/teams/:teamkey/squads", api_save_squads)
        .get_async("/api/teams/:teamkey/reminder.ics", api_reminder_ics)
        // --- API: admin ---
        .get_async("/api/admin/:teamkey/:teamsecret", api_admin)
        .put_async("/api/admin/:teamkey/:teamsecret/settings", api_update_settings)
        .post_async("/api/admin/:teamkey/:teamsecret/players", api_add_players)
        .delete_async("/api/admin/:teamkey/:teamsecret/players/:playerid", api_delete_player)
        .post_async("/api/admin/:teamkey/:teamsecret/reset_game", api_reset_game)
        .post_async("/api/admin/:teamkey/:teamsecret/game_off", api_game_off)
        .put_async("/api/admin/:teamkey/:teamsecret/default_squads", api_default_squads)
        .run(req, env)
        .await
}

// ============================================================
// HTML Redirects
// ============================================================

async fn html_home_redirect(_: Request, _ctx: RouteContext<()>) -> Result<Response> {
    redirect_to_ui("/")
}

async fn html_team_redirect(_: Request, ctx: RouteContext<()>) -> Result<Response> {
    let key = ctx.param("teamkey").unwrap();
    redirect_to_ui(&format!("/team/{}", key))
}

async fn html_admin_redirect(_: Request, ctx: RouteContext<()>) -> Result<Response> {
    let key = ctx.param("teamkey").unwrap();
    let secret = ctx.param("teamsecret").unwrap();
    redirect_to_ui(&format!("/admin/{}/{}", key, secret))
}

// ============================================================
// CORS Preflight
// ============================================================

async fn api_options(req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    no_content_response(&o)
}

// ============================================================
// JSON API Handlers
// ============================================================

async fn api_new_team(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let mut r = req.clone_mut()?;
    let body: serde_json::Value = r.json().await?;
    let name = body["name"].as_str().unwrap_or("").to_string();
    if name.is_empty() {
        return error_json("team name can't be empty", 400, &o);
    }

    let key = random::hex_string();
    let secret = random::hex_string();

    let new_team = Team {
        name,
        secret: secret.clone(),
        next_game: None,
        players: HashMap::new(),
        location: None,
        time: None,
        weekly_schedule: None,
        default_squads: HashMap::new(),
    };

    match ctx
        .kv("teams")?
        .put(&key, serde_json::to_string(&new_team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => json_response(
            &NewTeamResponse {
                team_key: key,
                team_secret: secret,
            },
            &o,
        ),
        Err(_) => error_json("failed to create team", 500, &o),
    }
}

async fn api_team(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;
    let games_kv = ctx.kv("games")?;

    let mut team: Team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    if let Some(ng_key) = &team.next_game {
        let ng_key = ng_key.clone();
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return json_response(&service::team_response(&team, &key, None), &o),
        };

        // Reset game if it's too old
        if service::should_reset_game(&team, &ng) {
            let new_game = service::make_new_game(&team, String::new());
            let new_ng_key = random::hex_string();

            if games_kv
                .put(&new_ng_key, serde_json::to_string(&new_game).unwrap())?
                .execute()
                .await
                .is_err()
            {
                return error_json("failed to create next game", 500, &o);
            }

            team.next_game = Some(new_ng_key);

            if teams_kv
                .put(&key, serde_json::to_string(&team).unwrap())?
                .execute()
                .await
                .is_err()
            {
                return error_json("failed to update team", 500, &o);
            }

            return json_response(
                &service::team_response(&team, &key, Some(new_game)),
                &o,
            );
        }

        // Populate unregistered players
        if service::populate_unregistered_players(&team, &mut ng) {
            let _ = games_kv
                .put(&ng_key, serde_json::to_string(&ng).unwrap())?
                .execute()
                .await;
        }

        json_response(&service::team_response(&team, &key, Some(ng)), &o)
    } else {
        json_response(&service::team_response(&team, &key, None), &o)
    }
}

async fn api_play(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let pid = ctx.param("playerid").unwrap().clone();

    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        service::set_player_status(&mut ng, &pid, true);

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => no_content_response(&o),
            Err(_) => error_json("failed to set play", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_not_play(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let pid = ctx.param("playerid").unwrap().clone();

    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        service::set_player_status(&mut ng, &pid, false);

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => no_content_response(&o),
            Err(_) => error_json("failed to set not_play", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_add_comment(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        let mut r = req.clone_mut()?;
        let body: serde_json::Value = r.json().await?;
        let comment = body["comment"].as_str().unwrap_or("");
        let author = body["author"].as_str();
        if let Err(msg) = service::add_comment(&mut ng, comment, author) {
            return error_json(msg, 400, &o);
        }

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => json_response(&ng.comments, &o),
            Err(_) => error_json("failed to add comment", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_add_guest(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        let mut r = req.clone_mut()?;
        let body: serde_json::Value = r.json().await?;
        let guest_name = body["guest_name"].as_str().unwrap_or("");
        if let Err(msg) = service::add_guests(&mut ng, guest_name) {
            return error_json(msg, 400, &o);
        }

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => json_response(&ng.guests, &o),
            Err(_) => error_json("failed to add guest", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_delete_guest(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let idx: usize = ctx
        .param("idx")
        .unwrap()
        .parse()
        .unwrap_or(usize::MAX);

    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        service::delete_guest(&mut ng, idx);

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => no_content_response(&o),
            Err(_) => error_json("failed to delete guest", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_new_game(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;
    let games_kv = ctx.kv("games")?;

    let mut team: Team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let mut r = req.clone_mut()?;
    let body: serde_json::Value = r.json().await.unwrap_or(serde_json::json!({}));
    let description = body["description"].as_str().unwrap_or("").to_string();

    let ng = service::make_new_game(&team, description);
    let ng_key = random::hex_string();

    if games_kv
        .put(&ng_key, serde_json::to_string(&ng).unwrap())?
        .execute()
        .await
        .is_err()
    {
        return error_json("failed to create next game", 500, &o);
    }

    team.next_game = Some(ng_key);

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => json_response(&ng, &o),
        Err(_) => error_json("failed to set next game for team", 500, &o),
    }
}

async fn api_save_squads(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        let mut r = req.clone_mut()?;
        let body: serde_json::Value = r.json().await?;

        if let Some(squads) = body["squads"].as_object() {
            ng.squads = squads
                .iter()
                .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                .collect();
        }

        if let Some(assignments) = body["assignments"].as_object() {
            let a = assignments
                .iter()
                .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                .collect();
            service::save_squad_assignments(&mut ng, a);
        }

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => no_content_response(&o),
            Err(_) => error_json("failed to save squads", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_reminder_ics(_req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let team = match get_team(&ctx).await? {
        Some(t) => t,
        None => return Response::error("not found", 404),
    };
    let game = match get_game(&ctx, &team).await? {
        Some(g) => g,
        None => return Response::error("no game", 404),
    };
    let date = match game.date {
        Some(d) => d,
        None => return Response::error("no date", 404),
    };

    use jiff::ToSpan;
    let reminder = date.checked_sub(1.days()).unwrap();
    let key = ctx.param("teamkey").unwrap();

    let mut lines = vec![
        "BEGIN:VCALENDAR".to_string(),
        "VERSION:2.0".to_string(),
        "PRODID:-//nextgame//EN".to_string(),
        "BEGIN:VEVENT".to_string(),
        format!(
            "DTSTART;VALUE=DATE:{}{:02}{:02}",
            reminder.year(),
            reminder.month() as u8,
            reminder.day()
        ),
        "RRULE:FREQ=WEEKLY".to_string(),
        format!("SUMMARY:Sign up for {}", team.name),
        format!("DESCRIPTION:{}/team/{}", UI_DOMAIN, key),
    ];
    if let Some(loc) = &team.location {
        lines.push(format!("LOCATION:{}", loc));
    }
    lines.push("END:VEVENT".to_string());
    lines.push("END:VCALENDAR".to_string());

    let body = lines.join("\r\n");
    let mut resp = Response::from_bytes(body.into_bytes())?;
    let headers = resp.headers_mut();
    let _ = headers.set("Content-Type", "text/calendar; charset=utf-8");
    let _ = headers.set("Content-Disposition", "inline; filename=\"nextgame-reminder.ics\"");
    Ok(resp)
}

// --- Admin API ---

async fn api_admin(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let game = get_game(&ctx, &team).await?;
    json_response(&service::team_response(&team, &key, game), &o)
}

async fn api_update_settings(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;

    let mut team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let mut r = req.clone_mut()?;
    let body: serde_json::Value = r.json().await?;
    service::apply_settings(&mut team, &body);

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => {
            let game = get_game(&ctx, &team).await?;
            json_response(&service::team_response(&team, &key, game), &o)
        }
        Err(_) => error_json("failed to update team settings", 500, &o),
    }
}

async fn api_add_players(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;

    let mut team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let mut r = req.clone_mut()?;
    let body: serde_json::Value = r.json().await?;
    let names = body["names"].as_str().unwrap_or("");
    if let Err(msg) = service::add_players(&mut team, names) {
        return error_json(msg, 400, &o);
    }

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => json_response(&team.players, &o),
        Err(_) => error_json("failed to add players", 500, &o),
    }
}

async fn api_delete_player(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();
    let pid = ctx.param("playerid").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;

    let mut team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    service::delete_player(&mut team, &pid);

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => no_content_response(&o),
        Err(_) => error_json("failed to delete player", 500, &o),
    }
}

async fn api_reset_game(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;
    let games_kv = ctx.kv("games")?;

    let mut team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    if let Some(ng_key) = service::reset_game(&mut team) {
        let _ = games_kv.delete(&ng_key).await;
    }

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => no_content_response(&o),
        Err(_) => error_json("failed to reset game", 500, &o),
    }
}

async fn api_game_off(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let games_kv = ctx.kv("games")?;
    if let Some(ng_key) = &team.next_game {
        let mut ng: Game = match get_game(&ctx, &team).await? {
            Some(g) => g,
            None => return error_json("game not found", 404, &o),
        };

        service::toggle_game_off(&mut ng);

        match games_kv
            .put(ng_key, serde_json::to_string(&ng).unwrap())?
            .execute()
            .await
        {
            Ok(_) => no_content_response(&o),
            Err(_) => error_json("failed to toggle game off", 500, &o),
        }
    } else {
        error_json("game not found", 404, &o)
    }
}

async fn api_default_squads(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let o = cors_origin(&req);
    let key = ctx.param("teamkey").unwrap().clone();

    let teams_kv = ctx.kv("teams")?;

    let mut team = match get_team_authed(&ctx).await? {
        Some(t) => t,
        None => return error_json("team not found", 404, &o),
    };

    let mut r = req.clone_mut()?;
    let body: serde_json::Value = r.json().await?;

    if let Some(squads) = body["squads"].as_object() {
        service::set_default_squads(&mut team, squads);
    }

    match teams_kv
        .put(&key, serde_json::to_string(&team).unwrap())?
        .execute()
        .await
    {
        Ok(_) => no_content_response(&o),
        Err(_) => error_json("failed to update default squads", 500, &o),
    }
}
