# Design tokens — extracted from the live Claude Design file (2026-07-13)

Source of truth: `design/PTO-Admin.dc.html`. Values below are the exact rendered ones.

## Fonts
- Sans: **Geist** (fallback Inter, system-ui). Body text.
- Mono: **Geist Mono**, `font-variant-numeric: tabular-nums`. All numbers in tables + the Remaining hero.

## Palette
| Role | Hex |
|---|---|
| Page background | `#f4f4f5` |
| Surface / card | `#ffffff`, subtle `#fafafa` |
| Hairline border | `#e4e4e7` (also `#f0f0f0` lighter, `#d4d4d8` stronger) |
| Text primary | `#18181b` (brand ink `#292d34` used in banner) |
| Text muted scale | `#52525b` → `#71717a` → `#a1a1aa` |
| **Accent (fills/bars/hero)** | `#7b68ee` |
| Accent text/link (AA on white) | `#5c4bd4`, hover `#4a3bc0` |
| Accent tints | `#e3defb` (bar track alt), `#f1eefe`, `#f6f4fe` |

## Read-only banner
- bar: `bg #fff8e0`, `border-bottom #ffe082`, text `#292d34`, 12.5px
- READ-ONLY pill: mono 10px, `bg #ffedb0`, `border #FFC800`, `color #7a5c00`, radius 5px, uppercase, letter-spacing .09em

## Status chips (bg / text / border)
- pending: `#fffbeb` / `#b45309` / `#fde68a`
- approved: `#f0fdf4` / `#15803d` / `#bbf7d0`
- complete: `#eff6ff` / `#1d4ed8` / `#bfdbfe`
- cancelled: `#f4f4f5` / `#71717a` / `#e4e4e7`
- denied: `#fef2f2` / `#b91c1c` / `#fecaca`

## Remaining column (hero)
- big number: Geist Mono, tabular-nums, `#18181b`, ~22px, weight 500–600; "/ N" muted
- usage bar under it: height 5px, radius 999, track `#f1f1f3` (or tint `#e3defb`), fill `#7b68ee`
- LOW chip: red-ish (`#dc2626` family) mono micro-chip; NONE LEFT same, stronger
- destructive button: `bg #dc2626`, white text

## Source dot (log)
- clickup: `#7b68ee` dot; manual: neutral `#a1a1aa` dot

## Shape
- radius: inputs/buttons ~8px, chips ~5–6px, cards ~10–12px
- scrollbar: thin, thumb `#d4d4d8`
