# People+Possibilities AI Diffusion Studio

## What this is

A Next.js web application (branded "People+Possibilities AI Diffusion Studio") with two modes: exploring existing AI deployment pathways, and designing a new one. The agent powering the conversation ("Jude") reads from a markdown wiki of real AI deployments and responds using the Anthropic API. Users sign in with email/password; designs persist per-user in Supabase across sessions and devices. Design conversations accept typed text, pasted context, and uploaded documents/images, and can generate two kinds of downloadable output document at any point.

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind CSS v4
- Anthropic API via a Next.js route handler (`/api/chat`), streamed
- Supabase (Postgres + Auth) for sign-in and all persistence — no bundled DB, this is a hosted Supabase project
- Client-side document/image extraction: `pdfjs-dist` (PDF), `mammoth` (.docx), `xlsx` (spreadsheets), `jszip` (.pptx slide XML scraping)
- PDF export of generated documents via `jspdf`
- Deployed on Vercel

## Project structure

```
/app
  layout.tsx                ← root layout, fonts, metadata ("People+Possibilities AI Diffusion Studio")
  globals.css                ← Tailwind entry + the cube-icon-spin keyframe/theme animation
  login/page.tsx              ← public sign-in / sign-up page (Supabase email+password)
  api/chat/route.ts           ← route handler, calls Anthropic API
  (app)/                       ← route group for everything behind auth, wrapped by Sidebar
    layout.tsx                  ← fetches the user's designs list server-side, renders <Sidebar>
    page.tsx                    ← home screen ("/") — renders DesignDetailView directly (quick-start a new design)
    explore/page.tsx             ← explore existing deployments
    design/page.tsx               ← grid of the user's saved designs; opens DesignDetailView per design
proxy.ts                    ← Next.js middleware (Supabase auth gate for every route except /login)
/lib
  supabase/client.ts          ← browser Supabase client factory
  supabase/server.ts           ← server Supabase client factory (cookie-based session)
  wiki-loader.ts                ← fetches and caches wiki markdown from GitHub (server-side, in-memory per instance, for the agent's context)
  pathways.ts                   ← client-side wiki index/pathway fetch + parsing, shared by the Explore page and Sidebar
  pathway-cache.ts               ← Supabase-backed shared cache for explore-init/explore-copy model output, keyed by a hash of the wiki content
  system-prompts.ts               ← system prompts for every mode
  dimensions.ts                    ← the Seven Dimensions Framework's structural shape (codes, names, stage list, status colors) — substantive content lives in the wiki
  design-conversation.ts            ← the `useDesignConversation` hook: the design page's whole state machine (lazy row creation, sendMessage, cube_update/meta parsing, attachment wiring, persistence)
  design-documents.ts                ← Supabase-backed versioned storage for generated Analysis Doc / Plan Document content
  designs-cache.ts                    ← short-lived in-memory cache for the /design grid's list query
  extract-text.ts                      ← client-side text extraction from uploaded files (pdf/docx/xlsx/pptx) and image-to-base64 conversion
  adoption-plan-markdown.ts             ← shared markdown-subset parser for generated documents (used by both the on-screen modal and the PDF export)
  adoption-plan-pdf.ts                   ← renders a generated document to a downloadable PDF via jsPDF
  logger.ts                                ← fire-and-forget conversation logging to Google Sheets
/components
  Sidebar.tsx              ← persistent left nav: branding, Explore/Design links, a contextual list (pathways or the user's designs), email + sign-out; collapses to a mobile drawer under `md`
  SignOutButton.tsx          ← signs out of Supabase and redirects to /login
  CubeIcon.tsx                 ← small spinning cube logo shown before "AI Diffusion Studio" branding, unchanged from earlier versions
  ChatPanel.tsx                  ← conversation panel, renders `**bold**` inline markdown, gates sending on pending attachments
  AttachmentsPanel.tsx             ← file drag-and-drop/attach panel shown alongside the design chat (desktop) or as a bottom sheet (mobile)
  DimensionList.tsx                  ← the seven dimensions as colored chips with a coverage legend below — replaces the old 3D cube visual entirely
  DesignDetailView.tsx                 ← the whole design-conversation screen: welcome/create state, active conversation, dimension chips, document generation
  AdoptionPlanModal.tsx                  ← modal that renders a generated document (Analysis Doc or Plan Document), with version history and PDF download
```

There is no `Cube3D.tsx` or `DimensionPanel.tsx` anymore — the 3D cube visual from earlier versions of this app has been replaced by `DimensionList`, a flat list of colored dimension chips.

## Auth and persistence

Every route except `/login` requires a signed-in Supabase user — enforced by `proxy.ts` (Next's middleware, exported as `proxy` per this Next.js version's convention), which redirects unauthenticated browser requests to `/login?next=<path>` and returns a 401 JSON body for unauthenticated `/api/*` requests. On each request it revalidates the session via `supabase.auth.getUser()` and forwards the verified email through an `x-user-email` request header, so `app/(app)/layout.tsx` doesn't need a second Auth API round trip just to render the sidebar.

`/login` is a single page that toggles between sign-in and sign-up (Supabase email + password, `createClient().auth.signInWithPassword` / `.signUp`).

Persistence is real and per-user, backed by three Supabase tables (`supabase/migrations/`), all with row-level security scoped to `auth.uid()` except `pathway_cache`, which is shared:

- **`designs`** — one row per in-progress or complete deployment design: `meta`, `cube_state`, and `messages` as `jsonb`, plus `updated_at`. A design row is created lazily — only once the user actually sends a first message or attachment, not the moment they land on a blank design screen.
- **`design_documents`** — versioned, append-only storage for generated Analysis Docs and Plan Documents. Each generation is checked against a content hash of `{messages, cubeState}` first; an unchanged hash serves the cached row instead of calling the model again, otherwise a new version (`v0.1`, `v0.2`, …) is inserted.
- **`pathway_cache`** — shared across all users (not per-user data), caching the silent `explore-init`/`explore-copy` model outputs per pathway slug, keyed by a hash of the wiki + framework content that produced them. A wiki edit changes the hash and naturally invalidates the cache — no manual busting needed.

## Wiki loading

The wiki is publicly accessible on GitHub. It is not bundled into the app — everything is fetched at runtime.

Repo: `https://github.com/kameshbhr/ai-diffusion-cube-wiki`. Raw base URL lives in `GITHUB_WIKI_BASE_URL` (server) and `NEXT_PUBLIC_GITHUB_WIKI_BASE_URL` (client).

**Server-side** (`lib/wiki-loader.ts`), used to build the agent's context:
- `loadWikiContext(pathwaySlug?: string)` — always fetches `wiki/index.md`; if a slug is given, also fetches that one pathway page; otherwise fetches every pathway page listed in the index. In-memory cache per server instance.
- `loadFrameworkContent()` — fetches `wiki/framework.md`, the Seven Dimensions Framework doc (dimension definitions, stage descriptions, the stage × dimension question bank). This is injected into every prompt that needs it via `frameworkBlock()` in `system-prompts.ts`, rather than hardcoded, so editing the wiki page changes the framework the app uses with no code change.

**Client-side** (`lib/pathways.ts`), used to render pathway lists without a round trip through the agent — shared by the Explore page and the Sidebar's contextual list:
- `parsePathways()` reads `wiki/index.md`'s `## Pathways` markdown table.
- `fetchPathways()` then overrides each entry's display name with that pathway file's own title (`parsePathwayTitle`, the first `# H1` line) — the index table's link text is just a short label and can drift from the pathway page's actual title.
- `fetchPathwayMarkdown(slug)` fetches one pathway page directly, used to read its metadata header (`**Sector:**`, `**Geography:**`, `**Deployment status:**`) and `## Summary` section on the Explore page.
- Both cache the in-flight promise (not just the resolved value), de-duping concurrent callers.

## The `/api/chat` route handler

Receives: `{ messages, mode, pathwaySlug?, cubeState?, meta?, versionNumber? }`

Modes:
- `explore` — regular back-and-forth chat about a selected pathway
- `explore-init` — silent, one-shot: analyses a pathway and returns only a `<cube_update>` block (no prose)
- `explore-copy` — silent, one-shot: generates the card blurb + panel summary for a pathway
- `design` — the design conversation; every response ends with a `<cube_update>` block (including a `meta` object)
- `design-adoption-plan` — on-demand: generates the full Analysis Doc (not a chat turn, rendered separately)
- `design-plan-document` — on-demand: generates the condensed, four-section Plan Document (not a chat turn, rendered separately)

Flow: loads wiki content via `loadWikiContext(pathwaySlug)` and the framework doc → picks the system prompt for the mode → calls `anthropic.messages.stream` with `claude-sonnet-4-6` (`max_tokens: 4096` for the two document-generation modes, `2048` otherwise) → streams text back to the client → fire-and-forget logs the exchange → for `explore-init`/`explore-copy`, also writes the parsed result into `pathway_cache` for next time.

The API key comes from `process.env.ANTHROPIC_API_KEY` — never hardcoded, never sent to the browser.

## System prompts (`lib/system-prompts.ts`)

### Explore mode (`exploreSystemPrompt`)

Injects the wiki content for the selected pathway plus the agent's own prior cube assessment (so it can answer "why is this amber?" consistently). Key behavioural rules:
- A gap is silence — something the record never addresses. Documented failures, lessons learned, and resolved issues are *not* gaps; they're evidence of a mature pathway.
- Never fabricate; never emit a `<cube_update>` block in this mode.
- **Dimension snapshot requests**: when asked about a specific dimension, respond in 2–3 sentences, then end with exactly: `"Do you want to know more about it or something else?"`

### Explore init (`exploreInitSystemPrompt`, mode `explore-init`)

A silent, hidden call fired once when a pathway is selected (cache-checked against `pathway_cache` first). The entire response must be a single `<cube_update>` block (no prose) scoring documentation coverage A–G. This is what colors the dimension chips on selection.

### Pathway copy generation (`explorePathwayCopySystemPrompt`, mode `explore-copy`)

A silent, hidden call fired once per pathway (cache-checked against `pathway_cache` first) that turns the wiki's dense narrative into short display copy — a `card` blurb for the list and a two-paragraph `summary` for the info panel. Falls back to the raw wiki index summary if it hasn't resolved yet or fails.

### Design mode (`designSystemPrompt`)

Drives Jude's one-question-at-a-time design conversation. This has grown well past a simple form-filler — see the file itself for the full text, but the shape is:

- **Driven vs. reactive modes**: absent a specific user question, the agent proactively drives the conversation forward (driven mode); when the user asks something directly, it answers at whatever depth the pathway content supports (reactive mode), then resumes the driven thread where it left off.
- **Grounding / content firewall**: general world knowledge may only be used to interpret what the user describes — never to generate what's said back to them. Every suggestion, risk, or recommendation must trace to actual wiki/framework content, distinguishing a close/literal pathway match from a thematic/transferable one.
- **Pathway/micro-innovation matching before the guided journey**: once there's a rough problem framing and stage, the agent actively searches for an exact or similar pathway match, or a reusable micro-innovation/toolkit component, before ever offering the full guided journey — and stops and waits after presenting that match/offer rather than bundling a suggestion into the same message.
- **The guided journey**: breadth-first across the aspects relevant to the user's role (a first pass raising one suggestion + one light check per aspect, a second pass following up on vague/partial replies), tailored by role (a Technical Architect gets Architecture/Data, a Program Owner gets Institution/Ecosystem/Operating Model, etc.), with a mandatory interim synthesis checkpoint after roughly every 4–5 questions.
- **Stage awareness**: the four stages (`Explore`, `Define`, `Pilot`, `Scale`) each have their own "done when" markers from the framework doc; moving to a new stage re-evaluates every aspect against that stage's bar rather than carrying statuses over.
- **Never surfaces the framework's own vocabulary** ("dimension," "framework," "stage" as jargon) — refers to things in plain language as "aspects" throughout, including the very first message.
- **Naming a real deployment**: described indirectly by what it did, by default — except when the user explicitly asks which one it is or for its name (answer plainly), or during a Handoff (when a suggestion runs deeper than the pathway's grounded content, naming the deployment and its contributor is the point).

Every response ends with the same `<cube_update>` JSON block described below, including a `meta` object (`name`, `sector`, `geography`, `status` — one of the four stages — and a running `summary`), which the design page's info panel populates progressively.

### Adoption Journey Plan (`adoptionPlanSystemPrompt`, mode `design-adoption-plan`)

Generates the full "Analysis Doc" — a standalone markdown document, not a chat turn. Groups the seven aspects into "What's Solid" / "Needs Attention" / "Not Yet Discussed" (bucket placement is precomputed from the real cube state, not left to the model), includes an "At a Glance" status list, a stage-readiness section grounded in the framework's "done when" markers, suggested next steps, and pathway-grounded "Related Pathway Experience." Falls back to a plain "not enough conversation yet" message if too little has been discussed.

### Plan Document (`planDocumentSystemPrompt`, mode `design-plan-document`)

Generates a short, four-section, executive-ready summary — distinct from the full Analysis Doc, same inputs. Sections: Project Summary, Key Gaps Identified (up to 10 bullets), Key Recommendations (up to 5, each grounded in a named pathway precedent), Next Steps (up to 5, numbered). Explicitly told not to pad any section to hit a target count.

Both document prompts share the same core rules: never fabricate, ground every recommendation in real wiki content (paraphrased, never quoted verbatim), and use the given `generatedAt` timestamp and version number rather than inventing one.

## Document upload and attachments

The design conversation accepts file and image attachments (`AttachmentsPanel.tsx`, wired through `useDesignConversation` in `lib/design-conversation.ts`):

- **Text-bearing files** (`.pdf`, `.docx`, `.xlsx`, `.xls`, `.pptx`, `.txt`, `.md`) are extracted entirely client-side (`lib/extract-text.ts`, via `pdfjs-dist`, `mammoth`, `xlsx`, and raw slide-XML scraping through `jszip` for `.pptx`) and folded into the next user message as plain text. Legacy binary Office formats (`.doc`, `.ppt`) aren't supported — only the modern XML-based formats.
- **Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) are base64-encoded client-side and sent as real image content blocks to Claude (5MB limit; documents are capped at 20MB).
- Attachments are staged (attach/drop, then Enter) rather than sent immediately, and multiple files can queue before one send. Previously-uploaded file names are recovered from message history for the "Shared in this chat" list, rather than tracked in separate state.

## Components

### `Sidebar.tsx`

Persistent left nav present on every authenticated page: branding + link home, Explore/Design nav links, then a contextual list below — pathways (fetched client-side) when inside `/explore`, or the signed-in user's designs (passed down from the server-rendered `(app)/layout.tsx`) when inside `/design`. Collapses to an off-canvas mobile drawer under Tailwind's `md` breakpoint, with its own top bar and hamburger toggle.

### `CubeIcon.tsx`

Unchanged in behaviour from earlier versions: a small decorative CSS 3D cube, spins via the `cube-icon-spin` keyframe (registered in `app/globals.css`) for 3.2s then settles at a resting angle.

### `ChatPanel.tsx`

Renders `**bold**` spans inline (simple regex split, not a full markdown renderer). Send is gated on any pending attachment still reading or errored, not just on empty input.

### `DimensionList.tsx`

Renders the seven dimensions as a wrapped row of colored chips (dot + name), each clickable to send a topic-starter prompt, plus a coverage legend below (`High` / `Medium` / `Critical gap` / `Not yet covered`) explaining what each color means. This is the only visual representation of dimension status now — there is no 3D cube anywhere in the app.

### `DesignDetailView.tsx`

The whole design-conversation screen, used both for the home page's quick-start (`initial=null`, no back button) and for an opened design from the `/design` grid. Two states: a centered welcome screen (drag-and-drop file zone, text input, three example pathway links) before any message has been sent, and the full conversation view (info header with dimension chips, chat, an attachments side panel on desktop / bottom sheet on mobile, and two document-generation buttons) once a conversation exists.

### `AdoptionPlanModal.tsx`

Renders a generated document (Analysis Doc or Plan Document) from its raw markdown using the shared parser in `lib/adoption-plan-markdown.ts` — headings, italic lines, bold runs, bullet/numbered lists, and status-colored bullets (parsing a `[green]`/`[amber]`/`[red]`/`[dark]` tag the model emits per line in the Analysis Doc). Includes a version-history dropdown when more than one version exists, and a "Download PDF" button (`lib/adoption-plan-pdf.ts`, via `jsPDF` — bold emphasis is flattened to plain text there since jsPDF can't mix styles within one `text()` call).

## Page designs

### Login (`/login`)

Cream background, cube icon + "People+Possibilities / AI Diffusion Studio" title, a single card that toggles between sign-in and sign-up (email + password via Supabase).

### Home (`/`)

Renders `DesignDetailView` directly in its welcome state — describe what you're building, or upload a document/image, to start a new design immediately. This does not add the new design to any list until the user actually sends something (lazy row creation).

### Explore page (`/explore`)

- No pathway selected: a card grid of the wiki's pathways ("Deployments Library").
- Pathway selected: an info header (name, `Sector · Geography · Status`, summary, dimension chips) above a chat panel. Selecting a pathway triggers one hidden `explore-init` call to color the dimension chips (checked against `pathway_cache` first) plus a separate `explore-copy` call for the card/summary text; clicking a dimension chip sends `"Give me a snapshot of the [dimension] dimension for this deployment."`
- Deep-linkable via `/explore?pathway=<slug>` (used by the Sidebar and by the home welcome screen's example pathway links).

### Design page (`/design`)

- No design open: a card grid of the signed-in user's saved designs (name, sector/geography, summary, relative "Updated Xm ago" time), fetched from Supabase (`lib/designs-cache.ts`, 60s in-memory TTL) with a "+ New Deployment" button and per-card delete.
- Design open: the same `DesignDetailView` as the home page, but with a back button and wired to append/update the opened design in the grid's cached list.
- Deep-linkable via `/design?open=<id>` (used by the Sidebar's "Deployments" list).

## Parsing cube updates

Both explore and design pages parse the same shape after each streamed response:

```ts
function parseCubeUpdate(text: string) {
  const match = text.match(/<cube_update>([\s\S]*?)<\/cube_update>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
```

(Design mode additionally destructures a `meta` key out of the parsed object before applying the rest as face updates — see `parseCubeUpdate` in `lib/design-conversation.ts`.)

**Stripping for display** does *not* wait for a closed block — it truncates at the first occurrence of the literal `<cube_update` opening tag, since every prompt places the block strictly at the end of the response with nothing after it:

```ts
function stripCubeUpdate(text: string): string {
  const idx = text.indexOf('<cube_update');
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}
```

## Environment variables

```
ANTHROPIC_API_KEY=your_key_here
GITHUB_WIKI_BASE_URL=https://raw.githubusercontent.com/kameshbhr/ai-diffusion-cube-wiki/main
NEXT_PUBLIC_GITHUB_WIKI_BASE_URL=https://raw.githubusercontent.com/kameshbhr/ai-diffusion-cube-wiki/main
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_JSON={...service account JSON...}
```

Same variables in the Vercel dashboard under Project Settings → Environment Variables. `GOOGLE_SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON` are used by `lib/logger.ts` for optional conversation logging — logging fails silently if absent. The Supabase migrations under `supabase/migrations/` must be applied to whatever project those URL/key variables point at before the app will work (designs, design_documents, pathway_cache tables).

## What's out of scope / not yet built

- The approval workflow for converting a design into a published wiki pathway
- The disbursement / guided-share feature
- Legacy binary Office formats (`.doc`, `.ppt`) for upload parsing — only modern XML-based formats are supported
- A true mobile-first layout — the Sidebar drawer and the design page's Files bottom sheet cover the main gaps, but the rest of the app (chat panels, document modal, card grids) is still primarily designed for desktop widths
