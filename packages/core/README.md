# `@lunariajs/core`

The `@lunariajs/core` package contains the base tracking and dashboard generation systems used across the toolchain.

Read the official [Lunaria documentation](https://lunaria.dev) to learn more about it.

## Installation

You can install `@lunariajs/core` using your preferred package manager:

```bash
# npm
npm install @lunariajs/core

# pnpm
pnpm add @lunariajs/core

# yarn
yarn add @lunariajs/core
```

## Basic Usage

Start using `@lunariajs/core` by setting up your own `lunaria.config.mjs` file and adding a script to your `package.json` file.

The example below contains all of the **required** options to generate a dashboard tracking the status of both the Portuguese and Spanish translations of a site:

```js
// lunaria.config.mjs
import { defineConfig } from '@lunariajs/core/config';

export default defineConfig({
  repository: {
    name: 'me/cool-docs',
  },
  sourceLocale: {
    label: 'English',
    lang: 'en',
  },
  locales: [
    {
      label: 'Português',
      lang: 'pt',
    },
    {
      label: 'Spanish',
      lang: 'es',
    },
  ],
  files: [
    {
      include: ['content/en/**/*.md'],
      pattern: 'content/@lang/@path',
      type: 'universal',
    },
  ],
});
```

Now, you need to add a new script to your `package.json` file to trigger a dashboard build during your website's deploy process, like so:

```diff
"scripts": {
    "docs:dev": "vitepress dev .",
    "docs:build": "vitepress build .",
    "docs:preview": "vitepress preview .",
+   "lunaria:build": "lunaria build"
  },
```

Want other usage examples? Head over to the [`examples/` directory](https://github.com/lunariajs/lunaria/tree/main/examples/) and inspect the source code for tips & tricks about using `@lunariajs/core` with other frameworks and environments.
