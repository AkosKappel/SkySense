# 0001: SvelteKit on Vercel

_Status: Accepted · Date: 2026-11-10_

## Context

SkySense joins a portfolio that already has React (Vite and TanStack Start), Vue, Nuxt, Next.js and Laravel projects. The app needs server-rendered first paint (a weather app is judged on how fast the answer appears), a small server layer to proxy and cache the weather API, and a small JavaScript bundle on phones. It keeps no data on a server.

## Options

- **SvelteKit:** server load functions and routes cover the proxy, Svelte compiles to small bundles, and it is a framework the portfolio does not show yet.
- **React with TanStack Start or Next.js:** well known from the other projects, larger runtime, adds no range.
- **Hosting at home** (like BudgetMaster and Oriel): full control, but every visit and build loads the home server, which already runs several live apps.
- **Vercel** (like the portfolio): CDN caching of API responses through `Cache-Control`, preview deploys per branch, free for this traffic.

## Decision

SvelteKit with TypeScript, deployed on Vercel with `@sveltejs/adapter-vercel`. The domain is `skysense.akoskappel.dev`, a DNS-only CNAME in Cloudflare.

## Consequences

- Server code must run in Vercel functions: no long-running processes, no in-memory state between requests. Caching relies on the CDN, not on the app.
- Moving to the home server later means switching to `adapter-node` and adding a Dockerfile; the app code stays the same.
- ESLint and Prettier instead of Biome (Biome's Svelte support is partial), so tooling differs from the React projects.
