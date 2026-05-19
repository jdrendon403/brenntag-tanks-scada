.PHONY: dev prod down logs ps build-prod

# ─── Desarrollo ──────────────────────────────────────────────────────────────
dev:
	docker compose up -d

dev-build:
	docker compose build
	docker compose up -d

# ─── Producción ──────────────────────────────────────────────────────────────
prod:
	@test -f .env.prod || (echo "ERROR: crea .env.prod desde .env.prod.example" && exit 1)
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

prod-build:
	@test -f .env.prod || (echo "ERROR: crea .env.prod desde .env.prod.example" && exit 1)
	docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# ─── Operaciones ─────────────────────────────────────────────────────────────
down:
	docker compose down

down-prod:
	docker compose -f docker-compose.prod.yml down

logs:
	docker compose logs -f

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f

ps:
	docker compose ps

restart-backend:
	docker compose restart app_scada
