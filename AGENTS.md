# Lunaria — Agent Guidelines

Lunaria is a localization management system for open-source projects. The repository is a
pnpm monorepo managed with Turborepo, containing two packages:

- `packages/core` — the main `@lunariajs/core` library (TypeScript, Node.js, ESM)
- `packages/dashboard` — dashboard UI (currently minimal)

---

## Repository Layout

```
lunaria/
├── biome.json            # Linter + formatter config (Biome)
├── turbo.json            # Turborepo pipeline
├── pnpm-workspace.yaml
├── package.json          # Root scripts
└── packages/
    ├── core/
    │   ├── src/          # Source files
    │   ├── tests/        # Test files (Node.js built-in test runner)
    │   ├── dist/         # Build output (generated, do not edit)
    │   ├── tsconfig.json
    │   └── tsconfig.test.json
    └── dashboard/
```

---

## Commands

All commands should be run from the **repository root** unless noted otherwise.

### Install dependencies

```sh
pnpm install
```

### Build

```sh
# Build all packages (excluding docs)
pnpm build

# Build only @lunariajs/core
pnpm build:core
```

### Lint / Format (Biome)

```sh
# Check lint and formatting (read-only, used in CI)
pnpm biome ci ./packages/core/

# Apply auto-fixes (lint + format + import organization)
pnpm biome check --write ./packages/core/

# Format only
pnpm biome format --write ./packages/core/
```

### Test

```sh
# Run all tests across the monorepo
pnpm test

# Run tests for core only (from repo root)
pnpm turbo test --filter=@lunariajs/core

# Run a single test file directly (from packages/core)
node --test "tests/unit/path-resolver.test.ts"

# Run tests matching a name pattern (Node built-in runner)
node --test --test-name-pattern="should make valid paths" "tests/unit/path-resolver.test.ts"
```

Tests use Node.js's built-in `node:test` runner — no Jest, Vitest, or other framework.

---

## Code Style

### Formatter & Linter: Biome

Configuration is in `biome.json`. Key settings:

- **Indentation**: tabs, width 2
- **Line width**: 100 characters
- **Trailing commas**: all (JS/TS)
- **Quote style**: single quotes
- **Semicolons**: always
- **Import organization**: auto-sorted (`organizeImports: on`)

### TypeScript

- Strict TypeScript (`@total-typescript/tsconfig/tsc/no-dom/library-monorepo`)
- `erasableSyntaxOnly: true` — no enums, no namespaces, no `declare` at value level
- `rewriteRelativeImportExtensions: true` — imports use `.ts` extensions in source
- All imports in `src/` must include the `.ts` extension: `import { foo } from './bar.ts'`
- Test files import from `../../src/...` with `.ts` extensions as well
- Prefer `type` imports when only types are needed: `import type { Foo } from './types.ts'`
- Avoid `any` — use `// biome-ignore lint/suspicious/noExplicitAny: <reason>` if unavoidable

### Import Rules

- Use the `node:` protocol for all Node built-ins (enforced as error):
  `import { readFile } from 'node:fs/promises'`
- No unused imports (enforced as error)
- Do not use `console.log` or `console.debug` directly — only `warn`, `error`, `info`,
  `time`, `timeEnd` are allowed. Prefer the `consola` logger instance passed via
  dependency injection.

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `path-resolver.ts`, `git-hosting-links.ts`)
- **Types / Interfaces**: `PascalCase` — prefer `type` aliases; use `interface` for
  public API shapes that may be extended (e.g., `LunariaConfig`, `LunariaOpts`)
- **Classes**: `PascalCase` (e.g., `LunariaGitInstance`, `Lunaria`)
- **Functions**: `camelCase` (e.g., `createPathResolver`, `findLatestTrackedCommit`)
- **Constants**: `SCREAMING_SNAKE_CASE` for module-level frozen objects
  (e.g., `CONSOLE_LEVELS`); `camelCase` for regular `const` variables
- **Private class fields**: use the native `#field` syntax, not `_field`
- **Exported error objects**: `PascalCase` noun phrases (e.g., `FileNotFound`,
  `ConfigValidationError`); structured as plain objects satisfying an `ErrorContext`
  interface with `name`, `title`, and `message` fields

### Types

- Prefer `type` over `interface` for most shapes; use `interface` only for extensible
  public API contracts
- Use `satisfies` to validate literal objects against interfaces without losing
  specificity: `export const Foo = { ... } satisfies ErrorContext`
- Non-empty array types: use `[T, ...T[]]` in schemas/types, `z.array(...).nonempty()` in Zod
- Utility types live in `src/utils/types.ts` (e.g., `Prettify<T>`, `RegExpGroups<T>`)
- Use Zod for all runtime validation; wrap `safeParse` in `parseWithFriendlyErrors`
  from `src/utils/utils.ts` to surface human-readable errors

### Error Handling

- Errors are defined as plain objects in `src/errors/errors.ts`, satisfying `ErrorContext`
- `message` can be a string or a function returning a string for contextual messages
- To log and halt: `this.#logger.error(SomeError.message(context)); process.exit(1)`
- To throw in utilities: `throw new Error(SomeError.message(context))`
- Catch unknown errors narrowly: `if (e instanceof Error) { ... }` before accessing `.message`
- Avoid swallowing errors silently; use `catch { return false }` only when falsy fallback
  is semantically correct (e.g., `findFilesEntry`)

### General Patterns

- Prefer `async/await` over raw promise chains
- Use `pAll` from `p-all` for bounded concurrency over arrays of async tasks
- Module-level constants that should not be mutated use `Object.freeze()`
- Schema files (`schema.ts`) hold all Zod schemas; `types.ts` holds inferred TypeScript
  types; keep them co-located per feature directory
- Public vs. private API split: internal helpers prefixed with `#` (private fields/methods)
  or kept unexported; public API re-exported from `src/index.ts` and `src/config/index.ts`
- Config loading uses `jiti` for CJS/ESM compatibility; do not use `require()` directly
- Comments on non-obvious logic are encouraged; prefer `/** JSDoc */` for exported symbols
  and `//` for inline clarifications

---

## Testing Conventions

- Test files are in `packages/core/tests/unit/` and named `*.test.ts`
- Use `node:test` (`describe`, `it`) and `node:assert` (`strict as assert`)
- Shared fixtures live in `tests/utils.ts` (e.g., `sampleValidConfig`)
- Use `assert.throws` / `assert.doesNotThrow` for synchronous error checks
- Use `assert.rejects` for async error checks
- Use `// @ts-expect-error` with a comment to test type-invalid inputs
- Do not rely on git history or file system in unit tests; use pure function inputs

---

## Package Manager & Tooling

- **Package manager**: pnpm (v10.6.4) — do not use npm or yarn
- **Node.js**: >=18.17.0
- **TypeScript**: ^5.8 — `tsc` for build, no bundler
- **Linter/Formatter**: Biome v2 (replaces ESLint + Prettier entirely)
- **Monorepo orchestration**: Turborepo v2
- **Versioning/Releases**: Changesets (`@changesets/cli`)
