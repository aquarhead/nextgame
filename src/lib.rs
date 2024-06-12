use minijinja::{context as mjctx, Environment as MiniJinjaEnv};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use worker::*;

#[derive(Serialize, Deserialize, Debug)]
struct Team {
  name: String,
  secret: String,
  next_game: String,
  players: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Game {
  players: HashMap<String, bool>,
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
  console_error_panic_hook::set_once();
  let router = Router::new();

  router
    .get_async("/", home)
    .get_async("/new", new)
    .get_async("/admin/:teamkey/:teamsecret", admin)
    .get_async("/team/:teamkey", team)
    .run(req, env)
    .await
}

async fn home(_req: Request, _: RouteContext<()>) -> Result<Response> {
  let mut mje = MiniJinjaEnv::new();
  minijinja_embed::load_templates!(&mut mje);
  let template = mje.get_template("home.html").unwrap();

  Response::from_html(template.render(mjctx!()).unwrap())
}

async fn new(_: Request, ctx: RouteContext<()>) -> Result<Response> {
  fn gen_rand() -> String {
    use sha3::{
      digest::{ExtendableOutput, Update, XofReader},
      Shake128,
    };
    let mut buf = [0u8; 32];
    getrandom::getrandom(&mut buf).unwrap();

    let mut hasher = Shake128::default();
    hasher.update(&buf);
    let mut reader = hasher.finalize_xof();
    let mut res1 = [0u8; 10];
    reader.read(&mut res1);
    hex::encode(res1)
  }

  let next_game = gen_rand();
  let game = Game {
    players: HashMap::new(),
  };
  match ctx.kv("games")?.put(&next_game, game)?.execute().await {
    Ok(_) => {}
    Err(_) => return Response::error("failed to create first game", 500),
  };

  let key = gen_rand();
  let secret = gen_rand();
  println!("{} {}", &key, &secret);
  let new_team = Team {
    name: "new team".to_string(),
    secret,
    next_game,
    players: Vec::new(),
  };

  return match ctx.kv("teams")?.put(&key, new_team)?.execute().await {
    Ok(_) => Response::ok("created!"),
    Err(_) => Response::error("failed to create team", 500),
  };
}

async fn admin(_: Request, _: RouteContext<()>) -> Result<Response> {
  Response::empty()
}

async fn team(_: Request, _: RouteContext<()>) -> Result<Response> {
  Response::empty()
}
