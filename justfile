mod api
mod web

alias d := dev

dev:
  mprocs --config mprocs.yaml

build: api::build web::build

deploy: api::deploy web::deploy
