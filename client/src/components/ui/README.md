# UI Component Library

Shared primitives for the KIIP Study app. Import from `components/ui`:

```jsx
import { Button, Card, Badge, Modal, ModalActions, Stack, EmptyState } from '../components/ui';
```

---

## Button

Unified button with 5 variants and 2 sizes. Renders as `<button>` by default; use `as={Link}` for navigation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `$variant` | `'primary'` \| `'secondary'` \| `'ghost'` \| `'danger'` \| `'accent'` | `'primary'` | Visual style. Primary = clay, accent = indigo. |
| `$size` | `'default'` \| `'compact'` | `'default'` | Height: 44px (default) or 36px (compact). |
| `as` | element/component | `'button'` | Polymorphic render (e.g., `as={Link}`). |
| `disabled` | boolean | `false` | Disables interaction, applies muted styling. |

---

## Card

Surface container with configurable padding, radius, shadow, and hover.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `$padding` | `'sm'` \| `'md'` \| `'lg'` \| `'none'` | `'md'` | Padding from theme space scale (16/24/40/0 px). |
| `$radius` | `'sm'` \| `'md'` \| `'lg'` | `'md'` | Border radius (10/14/18 px). |
| `$shadow` | `'sm'` \| `'md'` | `'sm'` | Box shadow elevation. |
| `$interactive` | boolean | `false` | Adds hover shadow + translateY effect. |
| `$alt` | boolean | `false` | Uses `surfaceAlt` background instead of `surface`. |

---

## Badge

Inline pill label with color presets.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `$color` | `'default'` \| `'indigo'` \| `'clay'` \| `'moss'` \| `'success'` \| `'warning'` \| `'danger'` | `'default'` | Background + text color preset. |
| `$size` | `'sm'` \| `'md'` | `'sm'` | Font size: 12px (sm) or 14px (md). |
| `$bold` | boolean | `false` | Sets font-weight to 600. |

**Accessibility note:** When Badge conveys status by color alone, pair with text or `aria-label` so screen readers can access the meaning.

---

## Modal

Dialog overlay with focus trap, Escape-to-close, click-outside-to-close, and backdrop blur.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClose` | function | *required* | Called on Escape, overlay click. |
| `ariaLabel` | string | *required* | Accessible label for the dialog. |
| `maxWidth` | number | `420` | Max width in px. |
| `maxHeight` | string | `'calc(100vh - 64px)'` | Max height CSS value. |
| `position` | `'center'` \| `'top'` | `'center'` | Vertical alignment. `'top'` = 15vh from top. |
| `zIndex` | number | `theme.zIndex.modal` | Z-index layer. |
| `flush` | boolean | `false` | Zero padding + overflow hidden (for custom layouts). |

**Also exports:** `ModalActions` — a flex row for footer buttons.

---

## Stack

Flexbox layout primitive.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `$horizontal` | boolean | `false` | Row direction instead of column. |
| `$gap` | number (space index) | `4` | Gap from `theme.layout.space` array. |
| `$align` | CSS align-items | `'stretch'` | Cross-axis alignment. |
| `$justify` | CSS justify-content | `'flex-start'` | Main-axis alignment. |
| `$wrap` | boolean | `false` | Enables flex-wrap. |

---

## EmptyState

Centered empty state with icon, title, description, and action slot.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | string/node | — | Large icon/emoji displayed above title. |
| `title` | string | — | Heading text. |
| `description` | string | — | Muted body text (max-width 40ch). |
| `children` | node | — | Action buttons or links below description. |

---

## Tests

```bash
cd client && npx vitest run src/components/ui/__tests__/
```

36 tests across 6 test files covering rendering, variants, themes, accessibility, and interaction.
