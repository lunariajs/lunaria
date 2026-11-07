---
"@lunariajs/core": minor
---

Changes `pattern` matching to work like file paths instead of URLs.

- Matching is now case-sensitive. For example, `docs/ES/intro.md` is no longer a file of the `es` locale. If your directories use a different casing than your locales' `lang` (e.g. `pt-BR` and `pt-br`), change one to match the other, or use a [custom parameter](https://lunaria.dev/guides/tracking/#custom-parameters).
- `#` and `?` are now regular characters, so parameters like `:name` match file names such as `c#.md`.
- A pattern now has to match the entire path. A trailing `/`, `#`, or `?` is no longer ignored.
