use std::collections::{HashMap, HashSet};
// use std::result::Result as StdRst;

use chrono::Utc;
use chrono_tz::Tz;
use minijinja::{context as mjctx, Environment as MiniJinjaEnv};
use serde::{Deserialize, Serialize};
use worker::*;
// use worker_kv::{KvError, KvStore};

mod random;

type PlayerID = String;

#[derive(Serialize, Deserialize, Debug)]
struct Team {
  name: String,
  secret: String,
  next_game: Option<String>,
  auto_expire_cron: Option<String>,
  #[serde(default)]
  timezone: Tz,
  // NB: https://github.com/RReverser/serde-wasm-bindgen/issues/10
  // so currently we need to manually serde_json it
  players: HashMap<PlayerID, String>,
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
  players: HashMap<PlayerID, bool>,
  guests: Vec<String>,
  // TODO: comments??
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
    .post_async("/admin/:teamkey/:teamsecret/player", add_player)
    .post_async("/admin/:teamkey/:teamsecret/player/:playerid/delete", delete_player)
    .post_async("/admin/:teamkey/:teamsecret/reset_game", reset_game)
    .post_async("/admin/:teamkey/:teamsecret/cron", set_cron)
    .get_async("/team/:teamkey", team)
    .post_async("/team/:teamkey/new_game", new_game)
    .post_async("/team/:teamkey/player/:playerid/play", play)
    .post_async("/team/:teamkey/player/:playerid/not_play", not_play)
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
    auto_expire_cron: None,
    timezone: Tz::default(),
    players: HashMap::new(),
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

async fn set_cron(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
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
  let tz = f.get_field("tz").map(|t| t.parse::<Tz>().ok()).flatten();
  if tz.is_none() {
    return Response::error("invalid time zone", 400);
  }
  let tz = tz.unwrap();

  let cron = f.get_field("cron").unwrap_or_default();
  if cron.len() == 0 {
    team.auto_expire_cron = None;
  } else {
    if cron_parser::parse(&cron, &Utc::now().with_timezone(&tz)).is_err() {
      return Response::error("invalid cron expression", 400);
    }

    team.auto_expire_cron = Some(cron);
    team.timezone = tz;
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
    Err(_) => Response::error("failed to set cron and tz", 500),
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

  let template = ctx.data.mje.get_template("team.html").unwrap();

  if let Some(ng_key) = team.next_game {
    let mut ng: Game = {
      let g = games_kv.get(&ng_key).text().await?;
      if g.is_none() {
        // MAYBE: unset the next_game field on the Team?
        return template
          .render(mjctx! {
            team_name => team.name,
            key,
          })
          .map_or(Response::error("failed to render team page", 500), Response::from_html);
      }
      let g = g.unwrap();
      serde_json::from_str(&g).unwrap()
    };

    // Add missing players
    let tp_set: HashSet<_> = team.players.keys().cloned().collect();
    let gp_set: HashSet<_> = ng.players.keys().cloned().collect();
    let new_players = tp_set
      .difference(&gp_set)
      .map(|pid| (pid.to_string(), false))
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

    let playing_count = ng.players.values().filter(|p| **p).count() + ng.guests.len();

    let description = {
      use pulldown_cmark::{Options, Parser};

      let mut options = Options::empty();
      options.insert(Options::ENABLE_GFM);
      let parser = Parser::new_ext(&ng.description, options);

      // Write to String buffer.
      let mut html_output = String::new();
      pulldown_cmark::html::push_html(&mut html_output, parser);
      html_output
    };

    template
      .render(mjctx! {
        team_name => team.name,
        key,
        ng,
        description,
        playing_count,
        players,
      })
      .map_or(Response::error("failed to render team page", 500), Response::from_html)
  } else {
    template
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
    players: team.players.iter().map(|(k, _)| (k.to_string(), false)).collect(),
    guests: Vec::new(),
  };

  let ng_key = random::hex_string();

  let mut pob = games_kv.put(&ng_key, serde_json::to_string(&ng).unwrap())?;

  if let Some(cron) = team.auto_expire_cron.clone() {
    if let Ok(exp) = cron_parser::parse(&cron, &Utc::now().with_timezone(&team.timezone)) {
      pob = pob.expiration(exp.timestamp() as u64);
    }
  }

  if pob.execute().await.is_err() {
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

async fn play(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
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

    if let Some(p) = ng.players.get_mut(pid) {
      *p = true;
    }

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

async fn not_play(req: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
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

    if let Some(p) = ng.players.get_mut(pid) {
      *p = false;
    }

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
      Err(_) => Response::error("failed to set not_play", 500),
    }
  } else {
    Response::error("game not found", 404)
  }
}
