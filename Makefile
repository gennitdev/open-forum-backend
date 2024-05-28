# Define environment variables and commands
export GENERATE_OGM_TYPES

# Targets
.PHONY: all schema-change backend frontend

all: schema-change

schema-change: backend frontend

backend: set-generate-ogm build-backend start-backend unset-generate-ogm start-backend-normal

frontend: compile-types start-frontend

# Backend targets
set-generate-ogm:
	@echo "Setting GENERATE_OGM_TYPES to true"
	@export GENERATE_OGM_TYPES=true

build-backend:
	@echo "Building backend"
	npm run build

start-backend:
	@echo "Starting backend to generate OGM types"
	npm run start
	@echo "Generating additional types"
	npm run codegen

unset-generate-ogm:
	@echo "Setting GENERATE_OGM_TYPES to false"
	@export GENERATE_OGM_TYPES=false

start-backend-normal:
	@echo "Starting backend normally"
	npm run start

# Frontend targets
compile-types:
	@echo "Regenerating TypeScript types"
	npm run compile

start-frontend:
	@echo "Starting frontend"
	concurrently "yarn dev"
