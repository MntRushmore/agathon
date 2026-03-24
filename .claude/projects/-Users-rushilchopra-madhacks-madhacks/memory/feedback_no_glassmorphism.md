---
name: No glassmorphism styling
description: Never use glassmorphism, transparency, or backdrop-blur effects — match the dashboard's clean card-based styling instead
type: feedback
---

No glassmorphism anywhere in the UI. Use the existing dashboard styling patterns instead.

**Why:** User explicitly corrected this — the app uses a clean, solid card-based design language, not frosted glass effects.

**How to apply:** For any new UI components, use: `bg-card` with `border border-border`, `bg-muted` for secondary backgrounds, `.icon-container` / `.board-card` CSS classes from globals.css, oklch color palette (green/blue/purple/amber variants), `rounded-xl` for cards. Never use `backdrop-blur`, `bg-*/50` transparency, or glass-like overlays.
