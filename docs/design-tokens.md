# Design tokens

The palette was sampled directly from `img/EMBLEMA VIRTUDES ATEMPORAIS.png`
with ImageMagick's pixel sampler:

| Token | Sample | Source pixel | Contrast against white | Use |
|---|---|---:|---:|---|
| `--brand-blue` / `--primary` | `#134069` | `(700, 900)` | 10.69:1 | Primary surfaces, text, controls |
| `--brand-green` / `--secondary` | `#007D00` | `(100, 780)` | 5.34:1 | Secondary surfaces and accents |
| `--brand-gold` / `--gold` | `#C0A659` | `(300, 500)` | 2.38:1 | Borders, icons, badges, dividers; not normal text on white |

The contrast ratios use the WCAG relative-luminance formula. Blue and green
meet the 4.5:1 normal-text threshold against white. Gold does not, so use dark
blue for text over gold or white. `src/index.css` defines the brand tokens,
light green accent, and neutral gray palette.

For readable secondary text, `--neutral-600` (`#59667D`) has a 5.55:1 contrast
ratio against white and `#F9FAFB`; `--neutral-500` (`#626B78`) has a 5.16:1
ratio against `#F9FAFB`. These neutral tokens are used for helper copy,
captions, placeholders, and other small text.

Inter is self-hosted with `@fontsource-variable/inter`; no remote font or image
CDN is used.
