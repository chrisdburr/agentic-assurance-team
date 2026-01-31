# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-agent research team system where multiple Claude Code instances (Alice, Bob, Charlie) collaborate via MCP tools, with real-time web dashboard and issue tracking via beads.

## Commands

### Development

```bash
# Team server (HTTP + WebSocket + MCP on port 3030)
cd team-server && bun run dev

# Dashboard (Next.js on port 3010)
cd team-dashboard && bun run dev

# MCP-only mode (stdio, for Claude Code integration)
bun run team-server/src/index.ts --mcp
```

### Install Dependencies

```bash
cd team-server && bun install
cd team-dashboard && bun install
```

### Linting

```bash
# Project uses Biome via ultracite preset
bunx biome check .
bunx biome check --write .  # Auto-fix
```

### Docker (Production)

```bash
# Dashboard + Traefik + Cloudflare Tunnel
# Note: team-server runs on host for Claude CLI access
docker-compose up -d
```

### Issue Tracking (beads)

```bash
bd ready           # Find available work
bd show <id>       # View issue details
bd update <id> --status in_progress
bd close <id>      # Mark complete
bd sync            # Sync with git
```

### Agent Sessions

```bash
# Start session as specific agent
export AGENT_ID=alice
claude
> /team:alice  # Run onboarding
```

### Worktrees

```bash
./scripts/worktree-create.sh alice beads-105  # Create agent worktree
./scripts/worktree-list.sh                    # List active worktrees
./scripts/worktree-cleanup.sh                 # Remove merged worktrees
```

## Architecture

### Components

```
team-server/src/     Bun + Hono server providing:
                     - MCP server (stdio) for Claude Code integration
                     - HTTP API for dashboard
                     - WebSocket for real-time updates
                     - Agent dispatcher for automated responses

team-dashboard/      Next.js 16 PWA providing:
                     - Chat interface with DMs and channels
                     - Agent status and standup views
                     - NextAuth authentication

.agents/             Runtime data:
                     identities/   Agent persona definitions (alice.md, bob.md, charlie.md)
                     channels/     JSONL channel message storage
                     shared/       ontology.yaml for consistent terminology
                     team.db       SQLite: messages, standups, status, users, channels

.claude/             Claude Code configuration:
                     agents/       Agent definitions for Task tool
                     skills/       Slash commands (/team:alice, /team:standup, etc.)
```

### Team Server Data Flow

1. **MCP Mode** (`--mcp`): Runs on stdio for Claude Code, provides tools for messaging/standups/status
2. **HTTP Mode** (default): Runs both MCP + HTTP server with WebSocket
3. **Dispatcher**: Polls for unread messages, spawns Claude Agent SDK sessions to respond

### Key Files

- `team-server/src/index.ts` - Entry point, routes, WebSocket handling
- `team-server/src/tools.ts` - MCP tool definitions and handlers
- `team-server/src/db.ts` - SQLite schema and queries (messages, standups, users, channels)
- `team-server/src/dispatcher.ts` - Agent session spawning via Claude Agent SDK V2
- `team-server/src/channels.ts` - JSONL-based channel message storage
- `team-dashboard/src/app/(chat)/` - Main chat UI routes
- `team-dashboard/src/lib/api.ts` - Server-side API client with auth

### MCP Tools Available

Messaging: `message_send`, `message_list`, `message_mark_read`, `message_thread`
Standups: `standup_post`, `standup_today`, `standup_orchestrate`
Status: `status_update`, `status_team`, `team_roster`
Channels: `channel_read`, `channel_write`, `channel_list`
Agent-to-agent: `ask_agent` (synchronous SDK V2 invocation)

### Authentication

Dashboard uses NextAuth with credentials provider, validating against team-server's `/api/auth/validate`. User IDs passed via `x-user-id` header for channel access control.

## Conventions

- **Biome** for linting/formatting (extends ultracite/biome/core)
- **TypeScript** throughout, ES modules
- **shadcn/ui** components with Base UI primitives in dashboard
  - Always add new components via `bunx --bun shadcn@latest add <component>` (from `team-dashboard/`)
  - Never install shadcn component packages directly with `bun add`
- **Tailwind CSS v4** in dashboard
- Channel messages stored in `.agents/channels/{channel}.jsonl`
- DM messages stored in SQLite `messages` table
- Agent IDs: `alice`, `bob`, `charlie` (lowercase)

## Environment Variables

See `.env.example`:
- `DISPATCHER_POLL_INTERVAL`, `DISPATCHER_COOLDOWN`, `DISPATCHER_ENABLED` - Dispatcher config
- `CLOUDFLARE_TUNNEL_TOKEN` - For production deployment

Agent sessions are managed in the SQLite DB (`sessions` table), not via environment variables. Use the dashboard's Refresh button or `POST /api/dispatcher/refresh/:agent` to reset an agent's session.

## Session Completion Protocol

When ending a work session, always:
1. Create issues for remaining work (`bd create`)
2. Close finished issues (`bd close`)
3. Sync and push: `git pull --rebase && bd sync && git push`

**Important:** Never manually `git add` or commit `.beads/` files. The `bd sync` command and git hooks handle beads data automatically.

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output CLAUDE.md|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-report-web-vitals.mdx,use-router.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
