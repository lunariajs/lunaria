---
"@lunariajs/core": patch
---

Fixes several cases where a `pattern` matched the wrong files or built the wrong paths.

- Custom parameters with a name starting with `lang` or `path`, like `@langTag`, are now recognized instead of being read as `@lang` followed by `Tag`.
- Placeholders used more than once in a pattern are now replaced every time.
- When more than one locale could match the same part of a path, the longest value is now used, so `pt-BR` is no longer read as `pt` followed by `-BR`.
- Locale `lang` and parameter values are now matched literally, so characters like `.` or `+` in them have no special meaning.
- Custom parameters set to an empty string no longer make a pattern invalid.
- Escaped placeholders, like `\\@lang`, now match the text `@lang`.
- Repeated parameters with both a prefix and a suffix, like `{/:path.}+`, now build correct paths.
