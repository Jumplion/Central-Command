# Project Scripts

This folder contains convenience shell scripts for common repository actions.

Run these from the repository root, or invoke them directly from `scripts/`.

## Available commands

- `scripts/install.sh` — install Node dependencies
- `scripts/dev.sh` — start the Electron dev server with hot reload
- `scripts/build.sh` — build the production bundles
- `scripts/start.sh` — preview the packaged app
- `scripts/test.sh` — run the Vitest suite
- `scripts/typecheck.sh` — run full TypeScript checks
- `scripts/package.sh` — build and package the app installer
- `scripts/lint.sh` — run a validation step using TypeScript typecheck

## Notes

Each script changes into the repository root so it works from anywhere inside the repo.
