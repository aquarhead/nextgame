use minijinja::{context as mjctx, Environment as MiniJinjaEnv};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::*;

mod random;

type PlayerID = String;

#[derive(Serialize, Deserialize, Debug)]
struct Team {
  name: String,
  secret: String,
  next_game: Option<String>,
  players: HashMap<PlayerID, String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Game {
  description: String,
  players: HashMap<PlayerID, bool>,
  guests: Vec<String>,
}

struct AppCtx {
  mje: MiniJinjaEnv<'static>,
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
  console_error_panic_hook::set_once();

  let mut mje = MiniJinjaEnv::new();
  minijinja_embed::load_templates!(&mut mje);

  let router = Router::with_data(AppCtx { mje });

  router
    .get_async("/", home)
    .post_async("/new_team", new_team)
    .get_async("/admin/:teamkey/:teamsecret", admin)
    .post_async("/admin/:teamkey/:teamsecret/player", add_player)
    .delete_async("/admin/:teamkey/:teamsecret/player/:player", delete_player)
    .get_async("/team/:teamkey", team)
    .post_async("/team/:teamkey/new_game", new_game)
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
  };

  return match ctx.kv("teams")?.put(&key, new_team)?.execute().await {
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

  let team = {
    let t = ctx.kv("teams")?.get(key).json::<Team>().await?;
    if t.is_none() {
      return auth_err;
    }
    t.unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  let template = ctx.data.mje.get_template("team_admin.html").unwrap();

  template
    .render(mjctx! {
      team_name => team.name,
      key,
      secret,
      players => team.players,
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

  let mut team = {
    let t = teams_kv.get(key).json::<Team>().await?;
    if t.is_none() {
      return auth_err;
    }
    t.unwrap()
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

  let pid = random::hex_string();
  team.players.insert(pid, name);

  return match teams_kv.put(key, team)?.execute().await {
    Ok(_) => {
      let mut admin_link = req.url()?.clone();
      admin_link.set_path(&format!("/admin/{}/{}", key, secret));

      Response::redirect(admin_link)
    }
    Err(_) => Response::error("failed to add player to team", 500),
  };
}

async fn delete_player(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let auth_err = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();
  let secret = ctx.param("teamsecret").unwrap();

  let team = {
    let t = ctx.kv("teams")?.get(key).json::<Team>().await?;
    if t.is_none() {
      return auth_err;
    }
    t.unwrap()
  };

  if &team.secret != secret {
    return auth_err;
  }

  Response::empty()
}

async fn team(_: Request, ctx: RouteContext<AppCtx>) -> Result<Response> {
  let not_found = Response::error("team not found", 404);

  let key = ctx.param("teamkey").unwrap();

  let _team = {
    let t = ctx.kv("teams")?.get(key).json::<Team>().await?;
    if t.is_none() {
      return not_found;
    }
    t.unwrap()
  };

  // TODO: check players list change

  // TODO: guest

  Response::empty()
}

async fn new_game(_: Request, _: RouteContext<AppCtx>) -> Result<Response> {
  // let next_game = random::hex_string();
  // let game = Game {
  //   players: HashMap::new(),
  // };
  // match ctx.kv("games")?.put(&next_game, game)?.execute().await {
  //   Ok(_) => {}
  //   Err(_) => return Response::error("failed to create first game", 500),
  // };

  // TODO: add TTL
  Response::empty()
}
