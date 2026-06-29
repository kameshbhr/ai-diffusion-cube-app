Claude Code Brief — AI Diffusion Cube Web App v1

What you are building

A Next.js web application called the AI Diffusion Cube. It has two modes: exploring existing AI deployment pathways, and designing a new one. The agent powering the conversation reads from a markdown wiki of real AI deployments and responds using the Anthropic API.



Tech stack



Next.js 14 (App Router)

Tailwind CSS for styling

Anthropic API via a Vercel serverless function (/api/chat)

Deployed on Vercel

No database, no auth for v1





Project structure

/app

&#x20; page.tsx              ← home screen

&#x20; explore/page.tsx      ← explore existing deployments

&#x20; design/page.tsx       ← design your deployment

/api

&#x20; chat/route.ts         ← serverless function, calls Anthropic API

/lib

&#x20; wiki-loader.ts        ← fetches and caches wiki markdown from GitHub

&#x20; system-prompts.ts     ← system prompts for each mode

/components

&#x20; Cube3D.tsx            ← the 3D cube component, six clickable faces

&#x20; ChatPanel.tsx         ← conversation panel

&#x20; DimensionPanel.tsx    ← dimension detail view



Wiki loading

The wiki is publicly accessible on GitHub. Do not bundle it into the app. Fetch it at runtime.

The GitHub repo is \[https://github.com/kameshbhr/ai-diffusion-cube-wiki/].

In wiki-loader.ts, write a function loadWikiContext(pathwaySlug?: string) that:



Always fetches wiki/index.md — this gives the agent navigational awareness

If a pathwaySlug is provided, also fetches wiki/pathways/\[slug].md

If no slug, fetches all pathway pages listed in the index

Returns the combined markdown as a single string



Cache fetched pages in memory for the duration of the session to avoid redundant fetches. Use fetch with next: { revalidate: 3600 } so pages refresh hourly.



The /api/chat serverless function

Receives: { messages, mode, pathwaySlug?, cubeState? }

Does:



Calls loadWikiContext(pathwaySlug) to get relevant wiki content

Selects the right system prompt based on mode (explore or design)

Injects the wiki content into the system prompt

Calls anthropic.messages.create with claude-sonnet-4-6

Streams the response back using Vercel's streaming response



The API key comes from process.env.ANTHROPIC\_API\_KEY — never hardcode it.

Use streaming so responses feel fast. Use the Anthropic SDK's streaming helper.



System prompts

Explore mode system prompt

You are the AI Diffusion Cube agent. You help users explore existing AI deployment pathways.



You have access to the following wiki content from real deployments:



\[WIKI CONTENT INJECTED HERE]



The six dimensions are:

A — Problem Orientation: what you build on

B — Architecture: what you build with

C — Institution: who deploys AI

D — Ecosystem: who executes

E — Workforce: who absorbs AI

F — Operating Model: what makes it last



When a user selects a pathway and asks about a dimension:

\- Surface gaps explicitly — what is missing or underdeveloped in that dimension

\- Surface reusable know-how only when directly relevant or when the user asks

\- Reference specific deployments by name, never generalise without attribution

\- Acknowledge gaps honestly — "not documented" is a valid and useful answer



Do not fabricate. Do not fill gaps with generalities.

Design mode system prompt

You are the AI Diffusion Cube agent. You help users design their own AI deployment.



You have access to the following wiki content from real deployments:



\[WIKI CONTENT INJECTED HERE]



The six dimensions are:

A — Problem Orientation: what you build on

B — Architecture: what you build with

C — Institution: who deploys AI

D — Ecosystem: who executes

E — Workforce: who absorbs AI

F — Operating Model: what makes it last



Your job is to understand the user's deployment context through conversation, one question at a time. As you learn about each dimension, return a structured cube state update in your response.



Every response that updates the cube must end with a JSON block in this exact format:

<cube\_update>

{

&#x20; "A": { "status": "green|amber|red|dark", "phrase": "one line summary or empty" },

&#x20; "B": { "status": "green|amber|red|dark", "phrase": "..." },

&#x20; "C": { "status": "green|amber|red|dark", "phrase": "..." },

&#x20; "D": { "status": "green|amber|red|dark", "phrase": "..." },

&#x20; "E": { "status": "green|amber|red|dark", "phrase": "..." },

&#x20; "F": { "status": "green|amber|red|dark", "phrase": "..." }

}

</cube\_update>



Status meanings:

\- dark: not yet discussed

\- amber: partially understood, gaps remain

\- green: well defined for this context

\- red: critical gap or risk identified



Start all faces as dark. Only update a face when you have genuine information about it.



When surfacing reusable know-how from existing pathways, always name the source deployment.



The Cube3D component

A CSS 3D cube rendered in the browser. Six faces, one per dimension (A–F).

Each face shows:



The dimension code (A, B, C, D, E, F)

The dimension name

A short phrase (gap summary in explore mode, design summary in design mode)

Color: dark (#1A3A5C) = unlit, green (#3D8B37), amber (#E8A838), red (#D64045)



The cube is draggable to rotate (mouse drag changes rotateX and rotateY CSS transform).

Clicking a face calls onFaceClick(dimensionCode) which the parent passes in.

In explore mode all faces load immediately from the pathway's wiki content.



In design mode faces start dark and update as the agent sends cube\_update blocks.



Page designs

Home screen (/)

Dark navy background (#0D1B2A).

Two large cards side by side:

Explore existing deployments



Subtitle: "Browse pathways from real AI deployments. See gaps, surface reusable know-how."



On click: navigate to /explore

Design your deployment



Subtitle: "Describe what you're building. Get a tailored deployment design across six dimensions."



On click: navigate to /design



Explore page (/explore)

Left panel (40% width): pathway list. Each card shows deployment name, sector, geography, and a gap count badge (amber or red). Clicking a card loads that pathway.

Right panel (60% width): split into top (cube, 50%) and bottom (chat, 50%).

When a pathway is selected:



Cube loads with faces colored from wiki content — agent pre-analyzes the pathway and sets face statuses

Chat panel opens with agent ready to discuss

Clicking a cube face sends a message to the agent: "Tell me about dimension \[X] for this pathway"





Design page (/design)

Split screen:

Left panel (40%): chat conversation. Agent asks questions one at a time. User can also drop in a document (accept .txt, .md, .pdf — read text content, send to agent as context).

Right panel (60%): the cube, starting all dark. Updates in real time as agent sends cube\_update blocks.

When a face lights up the agent sends a brief notification: "I have a clearer picture of your \[dimension name] now — face \[X] updated."

Clicking a lit face opens a dimension detail panel below the cube showing what's been captured and any reusable know-how from other pathways.



Parsing cube updates

In the frontend, after each agent response in design mode, parse the <cube\_update> block:

typescriptfunction parseCubeUpdate(text: string) {

&#x20; const match = text.match(/<cube\_update>(\[\\s\\S]\*?)<\\/cube\_update>/);

&#x20; if (!match) return null;

&#x20; try {

&#x20;   return JSON.parse(match\[1]);

&#x20; } catch {

&#x20;   return null;

&#x20; }

}

Strip the <cube\_update> block from the displayed message text before rendering it in the chat panel.



Environment variables

Create a .env.local file locally:

ANTHROPIC\_API\_KEY=your\_key\_here

GITHUB\_WIKI\_BASE\_URL=https://raw.githubusercontent.com/kameshbhr/ai-diffusion-cube-wiki/main

In Vercel dashboard add the same two variables under Project Settings → Environment Variables.



What done looks like for v1



Home screen loads with two options

Explore: select a pathway, cube loads with colored faces, can chat about any dimension

Design: start a conversation, cube updates progressively as dimensions are discussed, can click a face to see what's been captured

Deployed on Vercel with a shareable URL

API key never exposed to browser

Works on mobile (responsive layout — stack panels vertically on small screens)





What is explicitly out of scope for v1



User authentication or saved sessions

Persistent cube state across sessions (in-memory only)

The approval workflow for converting a design cube to a pathway

Document upload parsing beyond plain text extraction

The disbursement / guided share feature

