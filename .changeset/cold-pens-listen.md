---
"@lunariajs/core": patch
---

Reports invalid `pattern`s with clear errors.

- Syntax errors are now reported with an error pointing to the problem in your pattern. Previously, some of them were silently ignored, so the affected files were never matched.
- Patterns that can't build correct paths are now rejected: groups without a parameter (e.g. `doc{s}?`), named capturing groups (e.g. `(?<n>a)`), lookbehinds (e.g. `(?<=a)`), and a trailing `\`.
- Separate `source` and `locales` patterns now have to use the same parameters, except for `@lang` and custom parameters.
- A pattern now has to include a parameter named exactly like a placeholder. Previously, `:pathname` was accepted because it starts with `path`.
- Custom parameter names can now only contain letters, numbers, and underscores.
- Paths that don't match their pattern now report an error saying so.
