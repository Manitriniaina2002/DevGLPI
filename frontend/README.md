# GLPI Design System — Next.js

Design system for GLPI Ticket Management Dashboard, migrated from Vite/React to **Next.js 15** (App Router).

## Getting Started

```bash
npm install
npm run dev
npm run lint
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Update environment variables if needed

## Stack

- **Next.js 15** — App Router
- **React 19**
- **Tailwind CSS v4**
- **shadcn/ui** components (Radix UI)
- **Recharts** — data visualization
- **Lucide React** — icons

## Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (replaces index.html)
│   ├── page.tsx                # Main page (replaces App.tsx)
│   ├── globals.css             # Global styles entry
│   └── components/
│       ├── ui/                 # shadcn/ui components
│       ├── design-system/      # Design system showcases
│       └── figma/              # Figma-specific components
└── styles/
    ├── theme.css               # GLPI design tokens (colors, spacing, etc.)
    ├── tailwind.css            # Tailwind v4 setup
    └── fonts.css               # Font definitions
```

## Key Differences from Vite version

| Vite | Next.js |
|------|---------|
| `src/main.tsx` | `src/app/layout.tsx` |
| `src/app/App.tsx` | `src/app/page.tsx` |
| `index.html` | Built-in HTML shell |
| `vite.config.ts` | `next.config.ts` |
| `import './index.css'` | `import './globals.css'` in layout |

All components use `'use client'` since this is a fully interactive design system viewer.
