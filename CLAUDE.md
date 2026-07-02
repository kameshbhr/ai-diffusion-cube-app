# AI Diffusion Cube Web App — v1

## What this is

A Next.js web application called the AI Diffusion Cube. It has two modes: exploring existing AI deployment pathways, and designing a new one. The agent powering the conversation reads from a markdown wiki of real AI deployments and responds using the Anthropic API.

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind CSS v4
- Anthropic API via a Next.js route handler (`/api/chat`), streamed
- Deployed on Vercel
- No database, no auth for v1 — all state is in-memory in the browser tab

## Project structure

```
/app
  page.tsx              ← home screen
  layout.tsx            ← root layout, fonts, metadata
  globals.css           ← Tailwind entry + the cube-icon-spin keyframe/theme animation
  explore/page.tsx       ← explore existing deployments
  design/page.tsx       ← design your deployment
  api/chat/route.ts     ← route handler, calls Anthropic API
/lib
  wiki-loader.ts        ← fetches and caches wiki markdown from GitHub (server-side, for the agent's context)
  system-prompts.ts     ← system prompts for every mode
  logger.ts             ← fire-and-forget conversation logging to Google Sheets
/components
  Cube3D.tsx            ← the 3D cube, six clickable faces, resizable via a `size` prop
  CubeIcon.tsx           ← small spinning cube logo shown before "AI Diffusion Cube" on every page
  ChatPanel.tsx          ← conversation panel, renders `**bold**` inline markdown
  DimensionPanel.tsx     ← dimension detail view (design mode only)
```

## Wiki loading

The wiki is publicly accessible on GitHub. It is not bundled into the app — everything is fetched at runtime.

Repo: `https://github.com/kameshbhr/ai-diffusion-cube-wiki`. Raw base URL lives in `GITHUB_WIKI_BASE_URL` (server) and `NEXT_PUBLIC_GITHUB_WIKI_BASE_URL` (client — the explore/design pages fetch some wiki files directly from the browser).

**Server-side** (`lib/wiki-loader.ts`), used to build the agent's context: `loadWikiContext(pathwaySlug?: string)`
- Always fetches `wiki/index.md`
- If a `pathwaySlug` is given, also fetches `wiki/pathways/[slug].md`
- If no slug, fetches every pathway page listed in the index
- Caches fetched pages in memory per server instance; uses `fetch` with `next: { revalidate: 3600 }`

**Client-side** (`app/explore/page.tsx`), used to render the pathway list without a round trip through the agent:
- `wiki/index.md` has a `## Pathways` markdown table: `| [Name](pathways/slug.md) | Summary |`. `parsePathways()` reads this table (matching only links under `pathways/`, which naturally excludes the Synthesis/Entities/Sectors/Framework tables in the same file).
- Once a pathway is selected, `wiki/pathways/[slug].md` is fetched directly to read its metadata header (`**Sector:**`, `**Geography:**`, `**Deployment status:**`) and its `## Summary` section — `parsePathwayMeta()`. This is a deterministic fallback; see "Pathway copy generation" below for what's actually shown by default.

## The `/api/chat` route handler

Receives: `{ messages, mode, pathwaySlug?, cubeState? }`

Modes:
- `explore` — regular back-and-forth chat about a selected pathway
- `explore-init` — silent, one-shot: analyses a pathway and returns only a `<cube_update>` block (no prose)
- `explore-copy` — silent, one-shot: generates the card blurb + panel summary for a pathway (see below)
- `design` — the design conversation; every response ends with a `<cube_update>` block

Flow: loads wiki content via `loadWikiContext(pathwaySlug)` → picks the system prompt for the mode → calls `anthropic.messages.stream` with `claude-sonnet-4-6` → streams text back to the client → fire-and-forget logs the exchange.

The API key comes from `process.env.ANTHROPIC_API_KEY` — never hardcoded, never sent to the browser.

## System prompts (`lib/system-prompts.ts`)

### Explore mode (`exploreSystemPrompt`)

Injects the wiki content for the selected pathway plus the agent's own prior cube assessment (so it can answer "why is this amber?" consistently). Key behavioural rules:
- A gap is silence — something the record never addresses. Documented failures, lessons learned, and resolved issues are *not* gaps; they're evidence of a mature pathway.
- Never fabricate; never emit a `<cube_update>` block in this mode.
- **Dimension snapshot requests**: when asked about a specific dimension, respond in 2–3 sentences, then end with exactly: `"Do you want to know more about it or something else?"`

### Explore init (`exploreInitSystemPrompt`, mode `explore-init`)

A silent, hidden call fired once when a pathway is selected. The entire response must be a single `<cube_update>` block (no prose) scoring documentation coverage A–F. This is what colors the cube faces on selection.

### Pathway copy generation (`explorePathwayCopySystemPrompt`, mode `explore-copy`)

A silent, hidden call fired once per pathway (when the list loads, and again on selection if not already cached) that turns the wiki's dense narrative into short display copy. Response is a single JSON block:

```
<pathway_copy>
{
  "card": "...",
  "summary": "..."
}
</pathway_copy>
```

- `card` — 1–2 outcome-only sentences for the left-panel list card ("Created…", "Built…" — no stats, no pipeline detail).
- `summary` — two short paragraphs for the top info panel: first states who the pathway is useful to and what the reusable output is ("This pathway is useful to…"); second is a plain-language paragraph on what happened, avoiding granular numbers.

This keeps the card/summary copy readable without hand-authoring text per pathway, and generalises automatically to any pathway added to the wiki later. If this call hasn't resolved yet (or fails), the UI falls back to the raw wiki index summary / parsed `## Summary` section.

### Design mode (`designSystemPrompt`)

Drives a one-question-at-a-time conversation. Every response ends with a `<cube_update>` block:

```
<cube_update>
{
  "A": { "status": "green|amber|red|dark", "phrase": "..." },
  "B": { "status": "green|amber|red|dark", "phrase": "..." },
  "C": { "status": "green|amber|red|dark", "phrase": "..." },
  "D": { "status": "green|amber|red|dark", "phrase": "..." },
  "E": { "status": "green|amber|red|dark", "phrase": "..." },
  "F": { "status": "green|amber|red|dark", "phrase": "..." },
  "meta": {
    "name": "short working name, or empty string if not yet known",
    "sector": "or empty string",
    "geography": "or empty string",
    "status": "one of Concept, Pilot, Scaling, Active — or empty string",
    "summary": "2-3 sentence summary so far, or empty string"
  }
}
</cube_update>
```

Status meanings: `dark` = not yet discussed, `amber` = partially understood, `green` = well defined, `red` = critical gap/risk. All faces start `dark`.

The `meta` object is new this session — it lets the design page's top info panel populate a name, sector, geography, status, and summary progressively, the same way face colors populate, instead of needing a separate call. The agent is instructed to suggest a working `name` as soon as it knows what's being built, and to never blank out a field it has already learned.

## Components

### `Cube3D.tsx`

A CSS 3D cube, six faces (A–F), draggable via mouse to rotate (`rotateX`/`rotateY`). Accepts an optional `size` prop (default `220`, used by the design page's cube); the explore page uses `size={120}`. **Every face always shows the full dimension name** (e.g. "Problem Orientation"), scaled to fit — there is no letter-only/compact mode at any size. Colors: `dark` `#1A3A5C`, `green` `#3D8B37`, `amber` `#E8A838`, `red` `#D64045`. Clicking a face calls `onFaceClick(dimensionCode)`.

### `CubeIcon.tsx`

A small decorative cube (default `28px`, used at `40px` on the home page and `18px` in page headers) shown immediately before the "AI Diffusion Cube" title on every page. Spins via the `cube-icon-spin` CSS animation (registered in `app/globals.css` through Tailwind v4's `@theme { --animate-cube-icon-spin: ... }` + a sibling `@keyframes` — nesting `@keyframes` inside `@theme` silently drops the utility, so keep them siblings) for 3.2s, then settles at the same resting angle (`rotateX(-20deg) rotateY(30deg)`) the main cube starts at.

### `ChatPanel.tsx`

Renders `**bold**` spans inline (simple regex split, not a full markdown renderer — no lists/links/headers). Everything else renders as plain text with `whitespace-pre-wrap`.

### `DimensionPanel.tsx`

Design-mode-only detail card shown when a cube face is clicked, rendered inside the cube's side column.

## Page designs

### Home screen (`/`)

Cream background (`#F5EFE6`). Cube icon + "AI Diffusion Cube" title, subtitle: *"Explore, map and design AI deployments across six dimensions"*. Two cards side by side:

- **Explore existing deployments** — *"Explore pathways from real AI deployments - not just what they did, but what you can learn from them."* → `/explore`
- **Design your deployment** — *"Design your AI deployment guided by lived experience from real deployments."* → `/design`

### Explore page (`/explore`)

- **Left panel (30% width)**: pathway list. Each card shows the deployment name and an outcome-first one-line description (see "Pathway copy generation"). Clicking a card selects it.
- **Right panel**, once a pathway is selected:
  - **Top info panel** (25% height, full width): deployment name, `Sector · Geography · Status` line, and the summary paragraph — scrollable (`overflow-y-auto`) rather than clamped, since summaries vary in length and clipping was worse than a scrollbar.
  - **Bottom panel** (75% height): chat (majority width) on the left; a fixed ~190px column on the right holding the cube (`size={120}`) and its color legend below it.
- Selecting a pathway triggers one hidden `explore-init` call to color the cube; the pathway-copy call runs separately (see above) and does not block the cube.
- Clicking a cube face sends `"Give me a snapshot of the [dimension] dimension for this deployment."` to the agent.

### Design page (`/design`)

Structurally mirrors the explore page:

- **Left panel (30% width)**: list of deployments currently being designed in this session (each identified by `meta.name`, falling back to "New deployment"). Empty state shows a centered message with a large "+ Create New" button; once designs exist, the list is scrollable with a small "+ Create New" button pinned at the bottom.
- **Right panel**, once a design is selected:
  - **Top info panel** (25% height, full width): shows only the deployment name by default ("New deployment"). The `Sector · Geography · Status` line and summary paragraph appear only once the agent's `cube_update.meta` has populated them — nothing is shown as a placeholder before that.
  - **Bottom panel** (75% height): chat on the left, the cube (`size={120}`) + legend + (when a face is clicked) `DimensionPanel` in a fixed column on the right.
- Each design keeps its own messages, cube state, and meta — switching designs in the left panel swaps the whole right panel to that design's state. Nothing persists across a page reload (see "Out of scope").
- Opening message for a new design: *"Hi! I'm here to help you design your AI deployment. Can you provide a brief on what you are trying to do? What problem are you trying to solve, and who are the intended users?"*

## Parsing cube updates

Both explore and design pages parse the same shape after each streamed response:

```ts
function parseCubeUpdate(text: string) {
  const match = text.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
```

(Design mode additionally destructures a `meta` key out of the parsed object before applying the rest as face updates.)

**Stripping for display** does *not* wait for a closed block — it truncates at the first occurrence of the literal `<cube_update` opening tag:

```ts
function stripCubeUpdate(text: string): string {
  const idx = text.indexOf('<cube_update');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}
```

This matters because responses stream token-by-token: a regex that requires a matched closing tag lets the partial, still-arriving JSON render in the chat for a moment before disappearing once the tag closes. Since every prompt places `<cube_update>` strictly at the end of the response with nothing after it, cutting at the opening tag is safe and shows nothing extra.

## Environment variables

```
ANTHROPIC_API_KEY=your_key_here
GITHUB_WIKI_BASE_URL=https://raw.githubusercontent.com/kameshbhr/ai-diffusion-cube-wiki/main
NEXT_PUBLIC_GITHUB_WIKI_BASE_URL=https://raw.githubusercontent.com/kameshbhr/ai-diffusion-cube-wiki/main
```

Same variables in the Vercel dashboard under Project Settings → Environment Variables. (`GOOGLE_SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON` are also used, by `lib/logger.ts`, for optional conversation logging — logging fails silently if absent.)

## What done looks like for v1

- Home screen loads with two options
- Explore: select a pathway, cube loads with colored faces, info panel shows name/sector/geography/status/summary, can chat about any dimension
- Design: create one or more deployments in the same session, cube and info panel update progressively as dimensions are discussed, can click a face to see what's been captured
- Deployed on Vercel with a shareable URL
- API key never exposed to browser

## What is explicitly out of scope for v1

- User authentication or saved sessions
- Persistent state across page reloads — everything (including the design page's list of in-progress deployments) is in-memory for the current tab only
- Responsive/mobile-stacked layout — both explore and design use a fixed side-by-side layout regardless of viewport width
- The approval workflow for converting a design cube to a pathway
- Document upload parsing beyond plain text extraction
- The disbursement / guided share feature
