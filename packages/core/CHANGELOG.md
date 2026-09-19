# @lunariajs/core

## 0.2.0

### Minor Changes

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Replaces the `lunaria.config.json` file with a JavaScript or TypeScript configuration file.

  Lunaria now loads a `lunaria.config.mjs` file (or `.js`, `.ts`, `.mts`, `.cjs`, `.cts`) exporting your configuration, which can be wrapped with the new `defineConfig()` helper from `@lunariajs/core/config` for type hints.

  ```js
  // lunaria.config.mjs
  import { defineConfig } from '@lunariajs/core/config';

  export default defineConfig({
    repository: {
      name: 'me/cool-docs',
    },
    sourceLocale: { label: 'English', lang: 'en' },
    locales: [{ label: 'Português', lang: 'pt' }],
    files: [
      {
        include: ['content/en/**/*.md'],
        pattern: 'content/@lang/@path',
        type: 'universal',
      },
    ],
  });
  ```

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Renames and restructures several configuration properties:

  - `defaultLocale` is now `sourceLocale`.
  - `files[].location` is now `files[].include`, an array of glob patterns matching only the source files, and `files[].ignore` is now `files[].exclude`.
  - `ignoreKeywords` and `localizableProperty` are now `tracking.ignoredKeywords` and `tracking.localizableProperty`.
  - `renderer` now receives the renderer configuration object directly, instead of the path to a renderer configuration file.
  - `optionalKeys` of `dictionary` file entries now mirrors the structure of the dictionary, e.g. `{ footer: true, sidebar: { search: true } }`, and applies to every file matched by the entry, instead of being a record of shared paths with an array of top-level keys.

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - The `@lang` placeholder is now required in `files` patterns and strictly matches the `lang` of the configured locales, while the `@locales` placeholder has been removed.

  Projects where the source and localized files follow different structures, e.g. source files in the root of the content directory and localizations in a directory per locale, can now set `pattern` to an object with a `source` and a `locales` pattern:

  ```js
  files: [
    {
      include: ['src/content/docs/**/*.mdx'],
      exclude: ['src/content/docs/pt/**/*.mdx'],
      pattern: {
        source: 'src/content/docs/@path',
        locales: 'src/content/docs/@lang/@path',
      },
      type: 'universal',
    },
  ],
  ```

- [`0bf48b2`](https://github.com/lunariajs/lunaria/commit/0bf48b2a02651e9709ad3d9d6feef925dc72f44d) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Adds support for custom parameters in `files` patterns. Every locale can set a `parameters` object whose keys become `@`-prefixed placeholders in your patterns, e.g. to match file paths using `pt-BR` while the locale's `lang` is `pt-br`:

  ```js
  sourceLocale: { label: 'English', lang: 'en', parameters: { tag: 'en' } },
  locales: [{ label: 'Português do Brasil', lang: 'pt-br', parameters: { tag: 'pt-BR' } }],
  files: [
    {
      include: ['src/i18n/en.yml'],
      pattern: 'src/i18n/@tag.yml',
      type: 'dictionary',
    },
  ],
  ```

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Replaces the `lunaria()` runtime function with `createLunaria()`, which returns a `Lunaria` instance with methods to get the status of all or individual tracked files, as well as the final configuration and git hosting links:

  ```ts
  import { createLunaria } from '@lunariajs/core';

  const lunaria = await createLunaria();
  const status = await lunaria.getFullStatus();
  const fileStatus = await lunaria.getFileStatus('src/content/docs/en/guide.mdx');
  ```

  `createLunaria()` accepts an optional `config` object to use instead of loading the configuration file, a `force` option to ignore the git data cache, and a `logLevel` option.

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Changes the format of the localization status, both in the Runtime API and in the `status.json` file written by `lunaria build`.

  Each entry now includes the properties of its matching `files` entry, a `source` object, and an array of `localizations` with a `status` of `'up-to-date'`, `'outdated'`, or `'missing'`. 

  The git data of each file is exposed as `git.latestCommit` and `git.latestTrackedCommit`, replacing the `lastChange` and `lastMajor*` properties.

  The git hosting URLs are no longer part of the status.

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Dictionary key completion now checks nested keys, listing missing keys in the dashboard as dot-separated key paths, e.g. `nav.home`.

  Markdown, MDX, and Markdoc files can no longer be tracked as dictionaries using their frontmatter. YAML dictionaries are now parsed as whole YAML documents.

- [#178](https://github.com/lunariajs/lunaria/pull/178) [`83617cc`](https://github.com/lunariajs/lunaria/commit/83617cc0fa645bea9682f4c62aeb8a0b8e793b7e) Thanks [@ascorbic](https://github.com/ascorbic)! - Adds support for gettext `.po` and `.pot` files as dictionaries.

- [`904b935`](https://github.com/lunariajs/lunaria/commit/904b9353f5002a7278d23ba5464c8ef106e21024) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Adds the `merge` option to `dictionary` file entries, making the keys of one or more base locales count towards the completion of another locale. A key is only considered missing if it is absent from the locale and all of its base locales:

  ```js
  files: [
    {
      include: ['ui/en/**/*.json'],
      pattern: 'ui/@lang/@path',
      type: 'dictionary',
      merge: {
        'es-419': ['es'],
      },
    },
  ],
  ```

- [`12c4040`](https://github.com/lunariajs/lunaria/commit/12c4040d58b6d0412ca688f59d3ddb2aa44eb187) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Adds the `integrations` option. An integration is an object with a `name` and a `hooks.setup` function that receives the current `config`, an `updateConfig()` function, and a `logger`, allowing frameworks and tools to fill in or change your Lunaria configuration:

  ```js
  integrations: [
    {
      name: 'my-integration',
      hooks: {
        setup: ({ updateConfig }) => {
          updateConfig({ dashboard: { title: 'My Localization Status' } });
        },
      },
    },
  ],
  ```

- [`cbe2bff`](https://github.com/lunariajs/lunaria/commit/cbe2bff4644b0f104ce5251d16c54eca062f5fac) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Adds the `external` option to track the content of another repository. When enabled, the repository set in `repository` is cloned into `cloneDir` and tracked instead of the current working directory.

- [`205487f`](https://github.com/lunariajs/lunaria/commit/205487f58f47b2bcd5c6e80043997184ee787004) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Caches the git data of tracked files between builds in the new `cacheDir` directory (`./node_modules/.cache/lunaria` by default), so only the files changed since the last build need to have their history read again. The cache is invalidated when the `tracking` options change and can be ignored with the new `--force` CLI option.

- [`5c29c22`](https://github.com/lunariajs/lunaria/commit/5c29c22897273f27cbefd02014552a1362829050) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Lunaria no longer clones the full git history into `cloneDir` when running in a shallow repository. Instead, it fails with an error asking for the full history to be fetched, e.g. with `fetch-depth: 0` in `actions/checkout` or `git fetch --unshallow`. Deployments on Netlify and Vercel are detected and have their missing git data fetched automatically.

- [`e671dea`](https://github.com/lunariajs/lunaria/commit/e671dea16dfcbb45e61dd80fb772b6c1ab1838c0) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Updates the `lunaria` CLI for the new configuration and status formats:

  - `lunaria init` now creates a `lunaria.config.mjs` file, and asks before overwriting an existing configuration file.
  - `lunaria build` gains the `--force` option to ignore the git data cache.
  - `--skip-status` option has been removed in favor of faster, cached builds by default.
  - `lunaria sync` and `lunaria stdout` commands have been removed in favor of the new Runtime API.
  - Unknown commands and options now exit with a non-zero code and show the relevant help message.

- [`12d67bf`](https://github.com/lunariajs/lunaria/commit/12d67bfa72de2934fb0d7a49029c0a125956c967) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Removes the deprecated `@tracker-major` and `@tracker-minor` tracker directives in favor of `@lunaria-track` and `@lunaria-ignore`.

- [`431ed92`](https://github.com/lunariajs/lunaria/commit/431ed92de529bf4b81133e33a9ffce942dc8c407) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Updates all dependencies to their latest versions.

### Patch Changes

- [`2ed0dc5`](https://github.com/lunariajs/lunaria/commit/2ed0dc5b7e2d1b0b372b86f6e01c0a8a262feb45) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fixes inline SVG favicons not being encoded, which broke SVGs containing reserved URL characters.

- [`98097c2`](https://github.com/lunariajs/lunaria/commit/98097c2de36c7d1398773d3f49ab9bf7e9146f0a) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fixes an empty `ignoredKeywords` array ignoring every commit.

- [`0e8a44c`](https://github.com/lunariajs/lunaria/commit/0e8a44cb699fce59957144e74ffb3e3b8e3b0582) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fixes `@lunaria-ignore` directives incorrectly tracking the files listed in them.

- [`add3ea3`](https://github.com/lunariajs/lunaria/commit/add3ea39df784d778f129a86a022d33b4fe8ae3a) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Trims extra whitespace around the paths and globs of tracker directives.

- [`bb58040`](https://github.com/lunariajs/lunaria/commit/bb580402c2076ad3f07c6094bdd20ad9f39decb0) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Processes tracked files with limited concurrency, improving performance on large projects.

- [`84e6679`](https://github.com/lunariajs/lunaria/commit/84e66794b550123331dea1ce7afd8727f509fc92) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fixes cancelling a `lunaria init` prompt being treated as an empty answer.

- [`ddd2f18`](https://github.com/lunariajs/lunaria/commit/ddd2f18cebc17c4a1a99730578d804334da6d25d) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fixes `lunaria preview` ignoring the `outDir` set by integrations.

## 0.1.1

### Patch Changes

- [#147](https://github.com/yanthomasdev/lunaria/pull/147) [`30ecd70`](https://github.com/yanthomasdev/lunaria/commit/30ecd7027209eb466c326d5d05972d2a5ed174a4) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - Fix source history incorrect listing

## 0.1.0

### Minor Changes

- [#145](https://github.com/yanthomasdev/lunaria/pull/145) [`5327d2e`](https://github.com/yanthomasdev/lunaria/commit/5327d2e486885e7cd6cb280d0b71e4e37b62239a) Thanks [@yanthomasdev](https://github.com/yanthomasdev)! - The old `@tracker-major` and `@tracker-minor` tracker directives are deprecated in favor of `@lunaria-track` and `@lunaria-ignore`.

  A small error that wasn't being thrown when fetching a file's git history is now correctly thrown.

## 0.0.32

### Patch Changes

- 4ab0efa: Include commit hash in localization status data

## 0.0.31

### Patch Changes

- 1b6838e: Improve Zod errors
- 4c8fdf4: Add `stdout` command

## 0.0.30

### Patch Changes

- 54e44c1: Deprecate `--stdout-status` option

## 0.0.29

### Patch Changes

- 1518854: Remove `ufo` dependency
- 9d46185: Fix jiti type and bundling issue
- e6e444d: Add `--stdout-status` build option

## 0.0.28

### Patch Changes

- b7916c5: Add lunaria init command
- 8f79c52: Add lunaria preview command
- a3c2ce1: Miscellaneous fixes and optimizations

## 0.0.27

### Patch Changes

- ff2bda6: Add `readConfig` and fix `writeConfig` issue
- 52f43d6: Organize and extend exports
- b29f478: Expose `simpleGit` instance

## 0.0.26

### Patch Changes

- 8c09b43: Change `cloneDir` default
- c462f75: Improve renderer components types
- 9c325ae: Add lunaria sync command
- b804110: Improve types and status signature
- ff3be57: Simplify component system and dashboard generation
- 7838358: Update tracker directive names
- cbdb059: Improve generated `gitHostingLinks.history()`

## 0.0.25

### Patch Changes

- d1f6623: Rework CLI

## 0.0.24

### Patch Changes

- e885a65: Fix styling of dictionary entries
- 93b2c5d: Improve content API variables

## 0.0.23

### Patch Changes

- b95d480: Rework content source API
- f76b8a4: Update output defaults
- 5feafc8: Fix inline styles indentation
- f3c9fee: Allow multiple `external` favicons

## 0.0.22

### Patch Changes

- 032cd9a: Add programmatic API

## 0.0.21

### Patch Changes

- f87f91a: Fix `rootDir` issues
- 1821c06: Allow user labels to include HTML
- 4ad2709: Add new slot options

## 0.0.20

### Patch Changes

- 442517d: Add new `customCss` dashboard option
- c05f229: Add new progress bar design
- eaaa966: Improve color schema and variables
- a1d05f4: Add configuration JSON Schema support
- 535e6e6: Change `ignoreKeywords` defaults
- 2d6e7a0: Improve configuration errors
- 95267a4: Fix component rendering issues
- a778d74: Add support for tracking only dictionaries
- 7e63f52: Add favicon support

## 0.0.19

### Patch Changes

- 060b99a: Update README
- 92bee73: Add new repository hosting API
- d39d031: Add `dashboard.basesToHide` option
- 8fea07a: Reworked core configuration system
- f57c9f1: Add new `routingStrategy` API
- 0994668: Rework `dashboard.site` option

## 0.0.18

### Patch Changes

- 84cdc2c: Fix trailing slash issue in remote cloning
- 693a5b3: Improved "configuration not found" error

## 0.0.17

### Patch Changes

- 947892d: Fix tracker directives logic

## 0.0.16

### Patch Changes

- 9ef506b: Remove accidental `console.log`

## 0.0.15

### Patch Changes

- c765a19: Improve how `translatableProperty` is handled

## 0.0.14

### Patch Changes

- 99e4ee6: Move into supporting only GitHub
- df0ab02: Add `localePathConstructor` & improve git hosting links
- 59159a5: Improve `optionalKeys` API

## 0.0.13

### Patch Changes

- fba4d6f: Add missing `README.md` update

## 0.0.12

### Patch Changes

- 463ccd5: Rework package usage, refactor & move to ESM-only

## 0.0.11

### Patch Changes

- d33cc34: Improve `tsconfig.json` configuration

## 0.0.10

### Patch Changes

- 662d51d: Allow components to be imported
- 662d51d: Components reestructured and moved to their own file
- 662d51d: UI Dictionaries improvements & dashboard rendering fix
