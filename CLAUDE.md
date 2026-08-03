# 100 Pathways — Adoption Companion

## What this is

A Next.js web app, the conversational companion to **100pathways.com** — themed to match it exactly and linked back to it from every page's header. A signed-in user falls into one of two roles, each with its own dedicated flow (see "Roles and flows" below): **Explorers** work through their own AI adoption against the existing corpus; **Contributors** turn their own deployment write-up into a new corpus pathway page and push it live themselves. Everything either flow says is grounded in a corpus of real deployment pathways, committed into this repo (`content/wiki/`) plus anything since community-published (`published_pathways` in Supabase). Standing is tracked on a 4 dimensions × 4 stages grid internally, surfaced as four colored status chips (not a table) under the deployment's title/sector-geography-stage/summary header. Two documents can be generated at any point (Analysis Doc, Plan Document), versioned and cached in Supabase.

This is the `revamp-100pathways` branch — a full revamp replacing the earlier "AI Diffusion Studio" app (Explore mode, 7 dimensions, cream/brown theme all removed).

## Roles and flows

Three kinds of signed-in user, on top of the existing `user_roles` table:

- **Explorer** (`adopter` role) — entry point `/explore` (always starts a fresh adoption; existing ones open from `/adoptions`). `explorerSystemPrompt` (`lib/system-prompts.ts`) drives a few structured checkpoints on top of the grounding rules: state the deployment's stage once it's clear; proactively surface 1-2 relevant corpus micro-innovations unprompted; explicitly ask whether the user wants to explore existing pathways or their own gaps next; once at least 3 of the 4 dimensions reach density ≥ 2 at the current stage, offer (never insist on) the Analysis Doc. Genuine tangents are answered before returning to the current checkpoint — this is more directive than a "never set the agenda" companion, by design, but still never fabricates and never assigns a stage beyond what checkpoint 1 already stated.
- **Contributor** (`pathway_contributor` role) — entry point `/contribute`. `contributorSystemPrompt` drives six steps: (1) upload/describe the deployment; (2) confirm the stage (identical infer-and-confirm behavior to Explorer's step 2 — shared via `stageStatusStep()`); (3) remap into the four-dimension framework *silently* — this is just the prompt continuing to track its grid, no document is generated or shown yet; (4) in the same message as step 3, give a warm readout of what's well-established *and* the open gaps together, leading with what's working; (5) ask explicitly whether to skip the gaps and generate the wiki page now, or go through them one by one — only once the user actually chooses to generate does the real document get produced, via the separate `pathway-draft` mode and reviewed/revised in `PathwayDraftCanvas`'s "Ask for a change" box; (6) once satisfied, point them at "Push to Wiki" in the draft view. Pushing is genuinely self-serve — no separate admin approval step (see `app/api/pathway-submissions/push/route.ts`) — with a commit message, a diff against whatever's currently live, and a version history, GitHub-style.
- **Admin** — unchanged: `/admin` for role assignment/signup approval, plus a "Pathway Submissions" panel for oversight (list all submissions regardless of who owns them, mark reviewed, or publish on a contributor's behalf via the older `app/api/admin/pathway-submissions/publish/` route — kept alongside the contributor self-serve path, not replaced by it).

A signed-in user with neither `adopter` nor `pathway_contributor` sees an "ask an admin" message instead of a workspace. Someone holding both roles gets both sidebar entries and can run either flow on different adoptions — the choice is made once, per adoption, by which entry point they started from, and is stored as `meta.flow` (`'explorer' | 'contributor'`) on that row from then on. `app/api/chat/route.ts` re-validates `flow` against the caller's actual roles server-side — the sidebar/route gating is UX only.

## The framework

Defined by the "AI Diffusion Pathway Framework" doc, transcribed into `content/framework.md` (injected into every prompt — edit that file to change behavior, no code change):

- **Four dimensions**: Persona, Solution, Institution, Ecosystem — each with lettered sub-categories (4/5/7/6 respectively), each sub-category weighted **Primary / Secondary / Dormant** per stage.
- **Four stages**: Explore, Define, Pilot, Scale — each with "done when…" markers.
- **Five unit types** for corpus knowledge: Strategic Decision, Tactical Decision, Failure and Fix, Playbook, Toolkit Asset — every unit carries a condition tag (applies when / fails when).
- **30/70 thesis**: Persona+Solution = building the right thing; Institution+Ecosystem = the larger adoption work.

`lib/dimensions.ts` holds only the structural shape (codes, names, sub-categories, weights, stage list, density types, brand colors) — the substantive question bank lives in `content/framework.md`. `content/pathway-generation-prompt.md` is the contributor-side prompt for generating new pathway documents from raw material (not used at runtime).

Two hard rules from the framework that bind runtime behavior: pathway documents' **Provenance appendix is contributor-only** — never surfaced in any adopter-facing response; and the framework itself is never referenced as a process ("the framework," sub-category codes, densities, unit-type labels) in user-facing prose, though the four dimension and four stage names are public 100 Pathways vocabulary and fine to use naturally.

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind CSS v4
- Anthropic API via `/api/chat` route handler (`claude-sonnet-4-6`), streamed
- Supabase (Postgres + Auth) for sign-in, approval, roles, and all persistence
- Client-side document/image extraction: `pdfjs-dist`, `mammoth`, `xlsx` (SheetJS CDN build), `jszip`
- PDF export via `jspdf`; line diffing (the Contributor push view) via `diff`
- Theme: 100 Pathways brand tokens (navy `#1b1b42`, coral `#ff6543`, yellow `#feda09`, blue `#0099ff`, paper `#faf9f6`, ink `#363538`) with Inter / DM Sans / PT Serif / Geist Mono — copied verbatim from the Diffusion Library web app, which pulled them from the live site. All in `app/globals.css` as `@theme` tokens (`bg-paper`, `text-navy`, `text-coral`, `glow-input`, etc.).

## Wiki / corpus loading

The pathway corpus is committed into this repo at `content/wiki/pathways/` (`lib/wiki-loader.ts`), so it deploys on Vercel with no extra step — `WIKI_PATH` env var can still override the path (e.g. a different checkout in local dev) but nothing requires it. `loadWikiContext()` reads `pathways/index.md`, parses the relative `(slug.md)` links, and loads all pathway pages (7 currently, whole corpus ≈ 22K tokens with the framework — fine at this size; revisit with retrieval when it grows). `loadFrameworkContent()` reads `content/framework.md`, and `loadPathwayGenerationPrompt()` reads `content/pathway-generation-prompt.md` (used at runtime now too, by the `pathway-draft` mode). All reads go through one `readSource()` function so a future S3 move is a single swap.

Each of the 7 pathway docs was regenerated from the pre-revamp corpus (previously a simpler frontmatter+prose format under an old 7-category model) into the full Sections 0–6 + Provenance-appendix structure `content/pathway-generation-prompt.md` specifies — numbered, individually-tagged units (Strategic Decision / Tactical Decision / Failure and Fix / Playbook / Toolkit Asset), a Section 2 coverage grid, toolkit table, problem→solution table, and retrieval guide — reclassified into the new 4-dimension framework rather than re-derived from raw interviews (the Provenance appendix on each says so explicitly). `lib/wiki-content.ts` serves these for on-demand browsing at `/wiki` (`app/(app)/wiki/`), separately from the prompt-injection path — it strips the Provenance appendix before display (contributor-only, same rule as adopter-facing chat) and strips frontmatter. `components/WikiMarkdown.tsx` renders it (a richer markdown subset than `lib/adoption-plan-markdown.ts`'s parser — adds pipe-table support, since pathway docs lean on tables).

The old `wiki_cache`/`pathway_cache` Supabase tables and the GitHub-raw fetching path are no longer used (tables still exist in the DB, inert).

## Project structure

```
/app
  layout.tsx                ← fonts (Inter/DM Sans/PT Serif/Geist Mono), metadata
  globals.css                ← 100 Pathways theme tokens + animations (fade-in-up, bounce-dot, glow-input)
  login/page.tsx              ← sign-in / request-access (Supabase email+password, admin approval)
  admin/page.tsx               ← user approval + role management (see Auth section)
  api/chat/route.ts            ← modes: companion (flow: explorer|contributor) | analysis-doc | plan-document | extract-insights | pathway-draft
  api/admin/pathway-submissions/review/route.ts ← admin marks a submission reviewed
  api/admin/pathway-submissions/publish/route.ts ← admin publishes/updates a submission on a contributor's behalf
  api/pathway-submissions/push/route.ts ← CONTRIBUTOR self-serve push straight to published_pathways
  (app)/
    layout.tsx                  ← SiteHeader + approval gate (hasAnyRole) + Sidebar (now passes canExplore/canContribute)
    page.tsx                     ← redirects to /explore or /contribute by role; "ask an admin" if neither
    explore/page.tsx               ← dedicated Explorer entry point (role-gated, redirects home otherwise)
    contribute/page.tsx             ← dedicated Contributor entry point (role-gated, redirects home otherwise)
    adoptions/page.tsx               ← grid of the user's saved adoptions (?open=<id> deep link); "+ Explore"/"+ Contribute" buttons instead of a generic new-adoption action
    wiki/page.tsx                     ← on-demand corpus browsing: pathway index by category
    wiki/[slug]/page.tsx                ← one pathway page, Provenance appendix stripped
proxy.ts                    ← auth middleware (public: /login only)
/content
  framework.md               ← THE framework (question bank, weights, unit types) — prompt-injected
  pathway-generation-prompt.md ← generation rules + output structure — prompt-injected by `pathway-draft` too now
  wiki/pathways/*.md            ← the corpus itself, committed into the repo (see Wiki section above)
/lib
  dimensions.ts              ← structural shape: 4 dimensions, sub-categories, weights, GridState, densityToStatus/STATUS_COLORS (chip status)
  system-prompts.ts           ← explorerSystemPrompt, contributorSystemPrompt, analysisDocSystemPrompt, planDocumentSystemPrompt, documentInsightSystemPrompt, pathwayDraftSystemPrompt
  grid-update.ts                ← parseGridUpdate/stripGridUpdate — split out so app/api/chat/route.ts (server) can import it without pulling in adoption-conversation.ts's React hooks
  adoption-conversation.ts     ← useAdoptionConversation hook: AdoptionMeta.flow, lazy row creation (dedup'd via creatingRef), attachments, extractInsightsForAttachment
  pathway-submission-versions.ts ← upsertPathwaySubmission (one draft per design_id), version list/insert, getPublishedContentBySubmission (diff baseline)
  adoptions-cache.ts            ← 60s TTL cache for the adoptions list
  design-documents.ts            ← versioned Analysis Doc / Plan Document storage + content-hash caching
  wiki-loader.ts                  ← in-repo corpus reads for prompts, merged with published_pathways (see above)
  wiki-content.ts                   ← in-repo corpus reads for on-demand /wiki browsing, merged with published_pathways (Provenance-stripped)
  extract-text.ts                    ← client-side text extraction from uploads
  adoption-plan-markdown.ts           ← markdown-subset parser shared by modal + PDF (no tables)
  adoption-plan-pdf.ts                 ← jsPDF export
  roles.ts                              ← hasRole/hasAnyRole/isAdmin
  supabase/{client,server,admin}.ts      ← Supabase client factories (admin = service-role)
  logger.ts                               ← fire-and-forget Google Sheets logging
/components
  SiteHeader.tsx            ← "← Back | 100 Pathways / Adoption Companion" (matches Diffusion Library)
  Sidebar.tsx                 ← nav (Explore / Contribute — each role-gated / Your adoptions / The Wiki / Admin) + recent list; mobile drawer
  AdoptionWorkspace.tsx        ← the whole experience: welcome hero (fixedFlow-aware) → conversation header (title/sector-geo-stage/summary/chips) + docs
  DimensionChips.tsx            ← four status chips (ported from the pre-revamp DimensionList), one status per dimension at the deployment's current stage
  ChatPanel.tsx                  ← conversation panel (**bold** inline rendering)
  AttachmentsPanel.tsx            ← file staging panel (desktop side / mobile sheet)
  AdoptionPlanModal.tsx            ← generated-document modal with version history + PDF download
  PathwayDraftCanvas.tsx              ← Contributor's draft view: preview/diff toggle, "Ask for a change" (conversational revision), commit message + "Push to Wiki", version history
  WikiMarkdown.tsx                    ← markdown renderer with pipe-table support, used by /wiki and the draft modal
  AdminDashboard.tsx                    ← role checkboxes + reject
  PathwaySubmissionsPanel.tsx            ← admin list of all submissions, expand + mark reviewed/publish
  SignOutButton.tsx
```

Deleted in the revamp: Explore (the old 7-dimension version — routes, prompts, modes, `pathway_cache`), `DimensionList` (superseded by the new `DimensionChips`, same visual idea), `CoverageGrid` (the 4×4 table UI — the grid data model itself is unchanged, just no longer rendered as a table), `Cube3D`/`CubeIcon`, `lib/pathways.ts`, the 7-dimension `cube_update` contract, and the email-flow leftovers remain dormant (`lib/email.ts`, `nodemailer` — see SIGNUP_APPROVAL_OPTIONS.md).

## The `/api/chat` route handler

Receives `{ messages, mode, grid?, meta?, versionNumber?, designId?, flow? }`. Modes:

- `companion` — the conversation. `flow` (`'explorer' | 'contributor'`) picks `explorerSystemPrompt` or `contributorSystemPrompt`, re-validated server-side against the caller's actual role (`hasRole`) regardless of what the UI sent. Every response ends with a `<grid_update>` JSON block: `{ cells: {...changed cells only}, meta: {...}, pathwaysReferenced: [...], flowStep: N }`. `meta.stage` is only ever filled from the user's own statement. `flowStep` is the model's own report of which numbered step of its flow (5 for Explorer, 6 for Contributor) it's on — persisted as `AdoptionMeta.flowStep` and sent back in on every subsequent call as `grid`/`meta`, since the `<grid_update>` block is stripped before a message is stored and so never survives in replayed history; `currentProgressBlock()` in `lib/system-prompts.ts` re-injects it each turn as the model's one source of truth for "where am I," rather than asking it to re-infer position from prose. Client merges cells and strips the block for display. Every companion-mode call also inserts the user's last message into `adoption_queries`, tagged with `pathwaysReferenced` as `pathway_slugs` (fire-and-forget) — recorded material for future cross-adoption insight gathering, not surfaced anywhere yet.
- `analysis-doc` — full standing document: coverage-grid section in density notation, per-dimension narrative, Related Pathway Experience, Open Threads. Descriptive, never prescriptive. Available to both flows.
- `plan-document` — 4-section executive doc (Project Summary / Key Gaps ≤10 / Key Recommendations ≤5, each grounded in a named pathway / Next Steps ≤5, only user-surfaced actions). Title: `<name> Plan Doc v<N>`.
- `extract-insights` — silent, one-shot pass over a single uploaded document, called immediately on upload (before any conversation) from `extractInsightsForAttachment` in `lib/adoption-conversation.ts`. Returns only a `<grid_update>` block; seeds the grid the moment a file lands rather than waiting for the first chat turn.
- `pathway-draft` — drafts (or revises, given a trailing revision instruction) the current conversation as a candidate pathway document, in the exact Sections 0–6 + Provenance-appendix structure the real corpus uses (`content/pathway-generation-prompt.md` injected as the spec). Triggered by "Remap to Pathway Doc" in `AdoptionWorkspace.tsx` (Contributor flow only); never publishes itself — that's `PathwayDraftCanvas`'s "Push to Wiki" action, via `/api/pathway-submissions/push`.

All modes require an approved account (`hasAnyRole`) — 403 otherwise. Max tokens: 2048 companion, 1024 extract-insights, 4096 analysis/plan doc, 6144 pathway-draft.

## The two flows' posture (lib/system-prompts.ts)

Both flows share the same grounding discipline — never fabricate, always trace to a named pathway with its condition tag, never surface a Provenance appendix, never dump framework jargon — but differ in how directive they are, by design:

**Explorer** (`explorerSystemPrompt`) is close to "recommend, don't steer," but with four explicit checkpoints layered on: state the stage once it's clear; proactively surface 1-2 relevant micro-innovations unprompted (the one place it volunteers content); explicitly ask which direction the user wants (existing pathways vs. their own gaps); offer the Analysis Doc once ≥3 of 4 dimensions hit density 2+ at the current stage. Never assigns a stage beyond checkpoint 1, never manufactures agenda items outside these four.

**Contributor** (`contributorSystemPrompt`) is more of a guided pipeline, and shares Explorer's exact stage-confirmation step (`stageStatusStep()`). The remap into the four-dimension framework (step 3) is deliberately invisible — no document is generated or shown at that point, it's just the prompt's own grid-tracking continuing. Step 4 (same message as step 3) pairs what's well-established with the open gaps, leading with what's working. Step 5 offers an explicit choice — skip the gaps and generate the wiki page now, or go through them one by one — and only once the user actually chooses to generate does the real `pathway-draft` document get produced and opened for conversational revision. Genuine tangents get answered before returning to the current checkpoint either way — guided, not rigid.

Style for both: simple English, 4-sentence hard cap plus at most one clarifying question, genuine energy, varied phrasing.

## Auth, approval, and roles

`proxy.ts` gates everything but `/login`; signup is a request-access form (`supabase.auth.signUp` with name/organization metadata — requires "Confirm email" disabled in Supabase); zero rows in `user_roles` = pending, and `app/(app)/layout.tsx` shows an awaiting-approval screen; `/admin` (env `ADMIN_EMAILS` fallback OR the `admin` role) lists users with per-role checkboxes and destructive Reject.

**Role semantics are real again** (this is the change from the role-split rework): `adopter` gates the Explorer flow (`/explore`, and any adoption whose `meta.flow === 'explorer'`), `pathway_contributor` gates the Contributor flow (`/contribute`, self-serve push to the wiki). Any role still grants baseline access past the approval gate (`hasAnyRole`) — analysis/plan documents and `/wiki` browsing aren't flow-specific — but starting or continuing either named flow requires the matching role, checked both in the UI (`app/(app)/{explore,contribute}/page.tsx`, `Sidebar.tsx`) and re-validated server-side in `app/api/chat/route.ts`.

## Supabase tables

- **`designs`** — one row per adoption: `meta` (now includes `flow: 'explorer' | 'contributor' | ''`, fixed at creation), `grid_state` (renamed from `cube_state` in migration 0008, which also cleared pre-revamp test rows), `messages` jsonb. Lazy creation on first send **or** first uploaded document (whichever happens first — `extract-insights` needs a row to seed).
- **`design_documents`** — versioned generated docs, content-hash cached.
- **`pathway_submissions`** (migration 0009; `design_id` made unique in migration 0013 so the app can upsert "the one draft for this adoption") — the Contributor's draft: `design_id`, `content` (denormalized pointer to the latest version), `status` (`pending_review`/`reviewed`/`published`). Owner can insert/view/update their own (the update policy is what lets the contributor's own session push, not just the service-role client).
- **`pathway_submission_versions`** (migration 0013) — append-only version history per submission: `version_number`, `content`, `commit_message`. Inserted on every draft generation and every conversational revision — this is what backs the version-history dropdown and the diff view in `PathwayDraftCanvas`.
- **`adoption_queries`** (migrations 0010, 0011) — every companion-mode user message, insert-only, tagged with `pathway_slugs` (parsed from that turn's `<grid_update>.pathwaysReferenced` — which pathways the response actually drew on) for future cross-adoption insight gathering. Nothing reads this yet.
- **`published_pathways`** (migration 0012; `commit_message` column added in 0013) — publicly readable (RLS `using (true)`) so any approved user can see them at `/wiki`, and `loadWikiContext()` merges them into the companion's grounding corpus too. Two ways in: the Contributor's own "Push to Wiki" (`app/api/pathway-submissions/push/`, upserts by `source_submission_id` so re-pushing keeps the same slug/URL) or an admin publishing on their behalf (`app/api/admin/pathway-submissions/publish/`). Slugified from the adoption's name, checked for collisions against both the static files and this table. No git commit or redeploy needed — this is why the corpus is DB-backed for community content while the original 7 curated pathways stay as static files.
- **`user_roles`** — `(user_id, role)` grants: general_user | adopter | pathway_contributor | admin. `adopter`/`pathway_contributor` now have real behavioral meaning (see "Roles and flows" above), not just baseline access.
- Inert leftovers: `pathway_cache`, `wiki_cache`, `pending_signups` (nothing reads or writes them).

Migrations 0008 through 0013 must be run in the Supabase SQL Editor for the app to work post-revamp.

## Environment variables

```
ANTHROPIC_API_KEY=your_key_here
WIKI_PATH=/absolute/path/to/a/wiki/checkout   # optional; defaults to content/wiki/ in this repo
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only, /admin actions
ADMIN_EMAILS=a@x.com,b@y.com         # permanent admin fallback
GOOGLE_SHEET_ID=...                  # optional logging
GOOGLE_SERVICE_ACCOUNT_JSON={...}    # optional logging
```

`GITHUB_WIKI_BASE_URL`/`NEXT_PUBLIC_GITHUB_WIKI_BASE_URL` and the `SES_SMTP_*`/`EMAIL_FROM_ADDRESS`/`APP_URL` sets are no longer read by any active code path.

## Out of scope / not yet built

- Cross-user insights UI ("what did others ask about a pathway like mine") — `adoption_queries` now records the raw material for this, but nothing reads or surfaces it yet
- Any moderation/undo on a Contributor's self-serve push — once pushed, it's live; an admin can overwrite via the admin publish route but there's no "unpublish" or approval gate in front of the contributor's own push
- A user with neither `adopter` nor `pathway_contributor` has no workspace at all (just the "ask an admin" message) — there's no read-only/general_user experience beyond `/wiki` and `/adoptions`
- Legacy binary Office formats (.doc, .ppt) for uploads
