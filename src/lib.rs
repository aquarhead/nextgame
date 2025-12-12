use std::collections::{HashMap, HashSet};
// use std::result::Result as StdRst;

use minijinja::{Environment as MiniJinjaEnv, context as mjctx};
use serde::{Deserialize, Serialize};
use serde_json::json;
use worker::*;
// use worker_kv::{KvError, KvStore};
use jiff::civil::{Date, Weekday};

mod random;

type PlayerID = String;

#[derive(Serialize, Deserialize, Debug)]
struct Team {
  name: String,
  secret: String,
  next_game: Option<String>,
  // NB: https://github.com/RReverser/serde-wasm-bindgen/issues/10
  // so currently we need to manually serde_json it
  players: HashMap<PlayerID, String>,
  #[serde(default)]
  location: Option<String>,
  #[serde(default)]
  time: Option<String>,
  #[serde(default)]
  weekly_schedule: Option<i8>,
}

// impl Team {
//   async fn get(store: &KvStore, key: &str) -> StdRst<Self, KvError> {
//     let s = store.get(key).text().await?.unwrap();
//     serde_json::from_str(&s).unwrap()
//   }

//   async fn put(store: &KvStore, key: &str) -> StdRst<(), KvError> {
//     store.put(name, value)
//   }
// }

#[derive(Serialize, Deserialize, Debug)]
struct Game {
  description: String,
  // see Team struct comment
  players: HashMap<PlayerID, Option<bool>>,
  guests: Vec<String>,
  #[serde(default)]
  comments: Vec<String>,
  #[serde(default)]
  date: Option<Date>,
}

struct AppCtx {
  mje: MiniJinjaEnv<'static>,
}

#[event(fetch)]
async fn main(req: Request, env: Env, _: Context) -> Result<Response> {
  console_error_panic_hook::set_once();

  let mut mje = MiniJinjaEnv::new();
  minijinja_embed::load_templates!(&mut mje);

  let router = Router::with_data(AppCtx { mje });

  router
    .get_async("/", home)
    .post_async("/new_team", new_team)
    .get_async("/admin/:teamkey/:teamsecret", admin)
    .post_async("/admin/:teamkey/:teamsecret/settings", update_team)
    .post_async("/admin/:teamkey/:teamsecret/player", add_player)
    .post_async("/admin/:teamkey/:teamsecret/player/:playerid/delete", delete_player)
    .post_async("/admin/:teamkey/:teamsecret/reset_game", reset_game)
    .get_async("/team/:teamkey", team)
    .post_async("/team/:teamkey/new_game", new_game)
    .get_async("/team/:teamkey/playing_count", playing_count)
    .post_async("/team/:teamkey/player/:playerid/play", play)
    .post_async("/team/:teamkey/player/:playerid/not_play", not_play)
    .post_async("/team/:teamkey/comment", add_comment)
    .post_async("/team/:teamkey/guest", add_guest)
    // .post_async("/team/:teamkey/guest_count", new_game)
    .post_async("/team/:teamkey/guest/:guest/delete", delete_guest)
    .run(req, env)
    .await
}

async fn home(_req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let template = ctx.data.mje.get_template("home.html").unwrap();

  Response::from_html(template.render(mjctx!()).unwrap())
}

async fn new_team(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let mut r = req.clone_mut()?;
  let f = r.form_data().await?;
  let name = f.get_field("team_name").unwrap_or_default();
  if name.len() == 0 {
    return Response::error("team name can't be empty", 400);
  }

  let key = random::hex_string();
  // TODO: check key existence
  let secret = random::hex_string();

  let base_url = req.url()?;
  let admin_link = {
    let mut al = base_url.clone();
    al.set_path(&format!("/admin/{}/{}", &key, &secret));
    al.to_string()
  };
  let team_link = {
    let mut tl = base_url.clone();
    tl.set_path(&format!("/team/{}", &key));
    tl.to_string()
  };
  let team_name = name.clone();

  let new_team = Team {
    name,
    secret,
    next_game: None,
    players: HashMap::new(),
    location: None,
    time: None,
    weekly_schedule: None,
  };

  return match ctx
    .kv("teams")?
    .put(&key, serde_json::to_string(&new_team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let template = ctx.data.mje.get_template("new_team.html").unwrap();

      template
        .render(mjctx! {
          team_name,
          admin_link,
          team_link,
        })
        .map_or(
          Response::error("failed to render new_team page", 500),
          Response::from_html,
        )
    }
    Err(_) => Response::error("failed to create team", 500),
  };
}

async fn admin(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();

  let team: Team = {
    let t = ctx.kv("teams")?.get(key).text().await?;
    if t.is_none() {
      return auth_err;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  let template = ctx.data.mje.get_template("team_admin.html").unwrap();

  template
    .render(mjctx! {
      key,
      team,
    })
    .map_or(
      Response::error("failed to render team_admin page", 500),
      Response::from_html,
    )
}

async fn update_team(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();

  let teams_kv = ctx.kv("teams")?;

  let mut team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return auth_err;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  let mut r = req.clone_mut()?;
  let f = r.form_data().await?;
  team.location = f
    .get_field("location")
    .and_then(|s| if s == "" { None } else { Some(s) });
  team.time = f.get_field("time").and_then(|s| if s == "" { None } else { Some(s) });
  team.weekly_schedule = f.get_field("weekly_schedule").and_then(|s| {
    if let Ok(n) = s.parse::<i8>() {
      if n >= 1 && n <= 7 { Some(n) } else { None }
    } else {
      None
    }
  });

  return match teams_kv
    .put(key, serde_json::to_string(&team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let mut admin_link = req.url()?.clone();
      admin_link.set_path(&format!("/admin/{}/{}", key, secret));

      Response::redirect(admin_link)
    }
    Err(_) => Response::error("failed to update team settings", 500),
  };
}

async fn add_player(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();

  let teams_kv = ctx.kv("teams")?;

  let mut team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return auth_err;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  let mut r = req.clone_mut()?;
  let f = r.form_data().await?;
  let name = f.get_field("player_name").unwrap_or_default();
  if name.len() == 0 {
    return Response::error("player name can't be empty", 400);
  }

  name.trim().split(',').for_each(|n| {
    let pid = random::hex_string();
    team.players.insert(pid, n.to_string());
  });

  return match teams_kv
    .put(key, serde_json::to_string(&team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let mut admin_link = req.url()?.clone();
      admin_link.set_path(&format!("/admin/{}/{}", key, secret));

      Response::redirect(admin_link)
    }
    Err(_) => Response::error("failed to add player to team", 500),
  };
}

async fn delete_player(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();
  let pid = ctx.param("playerid").unwrap();

  let teams_kv = ctx.kv("teams")?;

  let mut team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return auth_err;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  team.players.remove(pid);

  return match teams_kv
    .put(key, serde_json::to_string(&team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let mut admin_link = req.url()?.clone();
      admin_link.set_path(&format!("/admin/{}/{}", key, secret));

      Response::redirect(admin_link)
    }
    Err(_) => Response::error("failed to remove player from team", 500),
  };
}

async fn reset_game(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let mut team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return auth_err;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  if let Some(ng_key) = team.next_game.take() {
    // try our best to clean up
    let _ = games_kv.delete(&ng_key).await;
  }

  return match teams_kv
    .put(key, serde_json::to_string(&team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let mut admin_link = req.url()?.clone();
      admin_link.set_path(&format!("/admin/{}/{}", key, secret));

      Response::redirect(admin_link)
    }
    Err(_) => Response::error("failed to reset game", 500),
  };
}

async fn team(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let not_found = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return not_found;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let template = ctx.data.mje.get_template("team.html").unwrap();

    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        // MAYBE: unset the next_game field on the Team?
        return ctx
          .data
          .mje
          .get_template("team_no_game.html")
          .unwrap()
          .render(mjctx! {
            team_name => team.name,
            key,
          })
          .map_or(Response::error("failed to render team page", 500), Response::from_html);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    // Populate unregistered players
    let tp_set: HashSet<_> = team.players.keys().cloned().collect();
    let gp_set: HashSet<_> = ng.players.keys().cloned().collect();
    let new_players = tp_set
      .difference(&gp_set)
      .map(|pid| (pid.to_string(), None))
      .collect::<HashMap<_, _>>();
    if new_players.len() > 0 {
      ng.players.extend(new_players.into_iter());
      match games_kv
        .put(&ng_key, serde_json::to_string(&ng).unwrap())?
        .execute()
        .await
      {
        Ok(_) => {}
        Err(_) => {
          return Response::error("failed to update player list", 500);
        }
      }
    }

    let mut players = ng
      .players
      .iter()
      .map(|(pid, playing)| {
        (
          team.players.get(pid).cloned().unwrap_or("Unknown player".to_string()),
          pid,
          playing,
        )
      })
      .collect::<Vec<_>>();
    players.sort();

    let playing_count = ng.players.values().filter(|p| p.unwrap_or(false)).count() + ng.guests.len();

    let description = {
      use pulldown_cmark::{Options, Parser};

      let mut options = Options::empty();
      options.insert(Options::ENABLE_GFM);
      let parser = Parser::new_ext(&ng.description, options);

      let mut html_output = String::new();
      pulldown_cmark::html::push_html(&mut html_output, parser);
      html_output
    };

    template
      .render(mjctx! {
        team_name => team.name,
        key,
        ng_key,
        ng,
        description,
        playing_count,
        players,
        location => team.location,
        time => team.time,
      })
      .map_or(Response::error("failed to render team page", 500), Response::from_html)
  } else {
    ctx
      .data
      .mje
      .get_template("team_no_game.html")
      .unwrap()
      .render(mjctx! {
        team_name => team.name,
        key,
      })
      .map_or(Response::error("failed to render team page", 500), Response::from_html)
  }
}

async fn new_game(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let not_found = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let mut team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return not_found;
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  let mut r = req.clone_mut()?;
  let f = r.form_data().await?;
  let description = f.get_field("description").unwrap_or_default();

  let ng = Game {
    description,
    players: HashMap::new(),
    guests: Vec::new(),
    comments: Vec::new(),
    date: None,
  };

  let ng_key = random::hex_string();

  if games_kv
    .put(&ng_key, serde_json::to_string(&ng).unwrap())?
    .execute()
    .await
    .is_err()
  {
    return Response::error("failed to create next game", 500);
  }

  team.next_game = Some(ng_key);

  return match teams_kv
    .put(key, serde_json::to_string(&team).unwrap())?
    .execute()
    .await
  {
    Ok(_) => {
      let mut team_link = req.url()?.clone();
      team_link.set_path(&format!("/team/{}", key));

      Response::redirect(team_link)
    }
    Err(_) => Response::error("failed to set next game for team", 500),
  };
}

async fn playing_count(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    let playing_count = ng.players.values().filter(|p| p.unwrap_or(false)).count() + ng.guests.len();

    Response::from_html(playing_count.to_string())
  } else {
    Response::error("game not found", 404)
  }
}

async fn play(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();
  let pid = ctx.param("playerid").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    ng.players.insert(pid.clone(), Some(true));

    match games_kv
      .put(&ng_key, serde_json::to_string(&ng).unwrap())?
      .execute()
      .await
    {
      Ok(_) => ctx
        .data
        .mje
        .get_template("player-reg.html")
        .unwrap()
        .render(mjctx! {
          key,
          pid,
          playing => true,
        })
        .map_or(Response::error("failed to render team page", 500), Response::from_html),
      Err(_) => Response::error("failed to set play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}

async fn not_play(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();
  let pid = ctx.param("playerid").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    ng.players.insert(pid.clone(), Some(false));

    match games_kv
      .put(&ng_key, serde_json::to_string(&ng).unwrap())?
      .execute()
      .await
    {
      Ok(_) => ctx
        .data
        .mje
        .get_template("player-reg.html")
        .unwrap()
        .render(mjctx! {
          key,
          pid,
          playing => false,
        })
        .map_or(Response::error("failed to render team page", 500), Response::from_html),
      Err(_) => Response::error("failed to set not_play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}

async fn add_comment(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    let mut r = req.clone_mut()?;
    let f = r.form_data().await?;
    let comment = f.get_field("comment").unwrap_or_default();
    if comment.len() == 0 {
      return Response::error("comment can't be empty", 400);
    }

    ng.comments.push(comment);

    match games_kv
      .put(&ng_key, serde_json::to_string(&ng).unwrap())?
      .execute()
      .await
    {
      Ok(_) => {
        let mut team_link = req.url()?.clone();
        team_link.set_path(&format!("/team/{}", key));

        Response::redirect(team_link)
      }
      Err(_) => Response::error("failed to set play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}

async fn add_guest(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    let mut r = req.clone_mut()?;
    let f = r.form_data().await?;
    let guests = f.get_field("guest_name").unwrap_or_default();
    if guests.len() == 0 {
      return Response::error("guest_name can't be empty", 400);
    }

    guests.trim().split(',').for_each(|g| ng.guests.push(g.to_string()));

    match games_kv
      .put(&ng_key, serde_json::to_string(&ng).unwrap())?
      .execute()
      .await
    {
      Ok(_) => {
        let mut team_link = req.url()?.clone();
        team_link.set_path(&format!("/team/{}", key));

        Response::redirect(team_link)
      }
      Err(_) => Response::error("failed to set play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}

async fn delete_guest(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let key = ctx.param("teamkey").unwrap();

  let teams_kv = ctx.kv("teams")?;
  let games_kv = ctx.kv("games")?;

  let team: Team = {
    let t = teams_kv.get(key).text().await?;
    if t.is_none() {
      return Response::error("team not found", 404);
    }
    let t = t.unwrap();
    serde_json::from_str(&t).unwrap()
  };

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        return Response::error("game does not exist anymore", 404);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    let g = urlencoding::decode(ctx.param("guest").unwrap()).unwrap().to_string();

    // TODO: only delete 1 guest
    ng.guests = ng.guests.into_iter().filter(|gg| *gg != g).collect();

    match games_kv
      .put(&ng_key, serde_json::to_string(&ng).unwrap())?
      .execute()
      .await
    {
      Ok(_) => {
        let mut team_link = req.url()?.clone();
        team_link.set_path(&format!("/team/{}", key));

        Response::redirect(team_link)
      }
      Err(_) => Response::error("failed to set play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}
