use minijinja::{context as mjctx, Environment as MiniJinjaEnv};
use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
  let router = Router::new();

  router
    .get_async("/", home)
    .post_async("/new", new)
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

async fn new(_: Request, _: RouteContext<()>) -> Result<Response> {
  Response::empty()
}

async fn admin(_: Request, _: RouteContext<()>) -> Result<Response> {
  Response::empty()
}

async fn team(_: Request, _: RouteContext<()>) -> Result<Response> {
  Response::empty()
}
