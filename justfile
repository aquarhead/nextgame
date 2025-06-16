export RUSTFLAGS := '--cfg getrandom_backend="wasm_js"'

dev:
  npx wrangler dev

build:
  npx wrangler deploy --dry-run

deploy:
  npx wrangler deploy
