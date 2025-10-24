# Repository Guidelines

## Project Structure & Module Organization
- `client/` hosts the VS Code extension; build output is in `client/out/` and tests in `client/out/test`.
- `server/` provides the language server entry (`server/index.ts`) and feature logic under `server/src/**`.
- `shared/` carries constants shared across processes, while `scripts/` contains helper tooling like `scripts/e2e.sh`.
- `dist/` and `client/out/` are generated; edit sources in `client/src/` and `server/src/`.

## Build, Test, and Development Commands
- `npm run compile` builds both workspaces via the root TS config.
- `npm run watch` keeps TypeScript in sync during active development.
- `npm run lint` (or `lint:fix`) runs ESLint; resolve warnings before committing.
- `npm run test` triggers the VS Code smoke suite (`scripts/e2e.sh`). Run `npm run compile` first so `client/out/` is fresh.
- `npm run vscode:prepublish` performs the Marketplace-ready bundle.

## Coding Style & Naming Conventions
- TypeScript + ES modules everywhere; keep explicit file extensions in imports.
- Use 2-space indentation, trailing semicolons, single quotes, and camelCase for symbols; reserve PascalCase for classes and SCREAMING_SNAKE_CASE for shared constants.
- ESLint (`eslint.config.mjs`) and the `tsconfig.base.json` types govern formatting and lint rules—run lint locally before raising a PR.

## Testing Guidelines
- Existing automation uses the VS Code integration harness; add new cases near the feature under `client/src/**/__tests__` or `server/src/**/__tests__`.
- Prefer `*.spec.ts` filenames so Vitest and editors can discover them. Mock HTTP fetches when touching `CssSchema` or the dependency graph.
- Write unit tests with Vitest (`npx vitest run`) using a whitebox mindset: inspect internal graph states, resolved values, and hover payloads rather than only surface results.
- Guard regressions by exercising hover markdown assembly and completion filtering for multi-theme inputs.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`fix:`, `feat:`, `chore:`); optional scopes (`fix(server): ...`) are encouraged. Commitlint enforces compliance.
- Validate `npm run lint` and `npm run test` before pushing. PRs should explain the change, include manual verification steps, and link related issues (`Fixes #42`).
- Attach screenshots or hover output snippets when the UX changes, and note any configuration needed for reviewers (`varsu.sourceUrl`, theme selectors).

## Configuration Tips
- Keep sample workspace settings in sync with `README.md` when adding new options.
- For manual checks, point `varsu.sourceUrl` at a locally served CSS file and declare themes like `{ "selector": ":root", "name": "Light" }` to mirror production setups.
