---
"@lunariajs/core": patch
---

Fixes an overflow issue in the dashboard's status by file table on narrow viewports.

The table now scrolls horizontally within its own container and no longer has a sticky header row. If you override the `Body` component, the `limit-to-viewport` class and its wrapper element have been removed.
