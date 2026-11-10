# Agent guide

Use this document as a source of verified project conventions when changing this repository. The project is a Discord music bot and dashboard backend using Discord.js, CommandKit, YangonKit, Express, Socket.IO, and `discord-player` v8. The dashboard frontend is not part of this repository.

## Architecture

- `src/app.ts` creates the Discord.js client with `Guilds` and `GuildVoiceStates` intents.
- `src/createPlayer.ts` creates and initializes the shared Discord Player, registers Spotify and YouTube extractors, and connects player events to Discord messages and Socket.IO.
- `src/server/socket.ts` owns the shared Socket.IO server instance. `src/server/server.ts` attaches it to the HTTP server, configures authentication, mounts the API router, and starts listening.
- `src/server/api/index.ts` imports route modules for their registration side effects and exports the shared router. Add new route modules there so they are loaded at startup.
- `src/server/api/authenticateJWT.ts` validates the bearer token and sets the decoded user/guild claims on `res.locals.auth`.
- `src/web/createSecureToken.ts` signs and verifies dashboard JWTs. Tokens include `user` and `guild` and expire after three hours.
- `src/lib/` contains shared queue metadata/types, command guards, embeds, filter presets, and URL utilities.

Keep module dependencies directed to avoid cycles: player code may import the standalone Socket.IO instance, but should not import `server.ts`, which imports the API routes; API route handlers may import the shared player.

## Slash commands

Commands are declared with YangonKit macros, enabled by `yangonKit()` in `commandkit.config.ts`:

- `$: SlashCommand(description, options?)` declares a slash command; the next function is the handler.
- `$param(type, options)` declares an option inside the handler. Its name is inferred from the variable name.

Example:

```ts
$: SlashCommand("Play a track")
export default async function play({ interaction }: ChatInputCommandContext) {
    const query = $param(ApplicationCommandOptionType.String, {
        description: "Track to play",
        required: true
    });
    // Handle the interaction.
}
```

Existing commands are `/play`, `/skip`, and `/web`. Music commands use `guardMusicCommand` for voice-channel and queue checks. `/web` issues an ephemeral dashboard URL; treat its JWT as a credential.

## HTTP API

All API routes are mounted below `/api` and protected by `authenticateJWT` using `Authorization: Bearer <dashboard-jwt>`. The claims are available as `res.locals.auth` (`user` and `guild`). Keep the route table below synchronized with the implementation.

| Method and path | Behavior |
| --- | --- |
| `GET /api/me` | Fetches the token user; response adds `userAvatarURL`. |
| `GET /api/guild` | Fetches the token guild; response adds `guildIconURL`. |
| `GET /api/search?query=<text>` | Searches for the token user and returns up to five serialized tracks; invalid/missing query is `400`. Search failures return an empty array. |
| `GET /api/queue/current` | Returns the current serialized track; missing queue/current track is `404`. |
| `GET /api/queue?offset=0` | Returns `{ size, tracks }` with at most 20 queued tracks; invalid offset is `400`, missing queue/current track is `404`. |
| `POST /api/queue` | Adds a deserialized track to an existing queue. Invalid payloads and playlists are `400`; missing queue is `404`; success returns `{ position }`. |
| `POST /api/queue/skip` | Skips the current track; missing queue is `404`, no current track is `409`, success is `204 No Content`. |

`src/server/server.ts` installs `express.json()`, so JSON request bodies are parsed. The queue-add route passes its body to Discord Player's `deserialize`; maintain compatibility with the expected serialized payload and validate untrusted input. API serialization formats should not be assumed to be live class instances.

## Socket.IO

Clients authenticate with the dashboard token in `auth.token`; successful connections join `guild:<guild-id>`. Current player events include `playerStart`, `emptyQueue`, `playerPause`, and `playerResume`. Start events carry the track JSON, empty-queue events carry no payload, and pause/resume events carry the player timestamp/progress.

Use the same token for HTTP and Socket.IO. Do not log or expose dashboard URLs or JWT secrets. The server does not currently define an explicit Socket.IO CORS policy; deployment-facing changes should use a deliberately restricted trusted origin rather than a permissive wildcard.

## Configuration and commands

Environment variables are documented in `.env.example`:

| Variable | Purpose |
| --- | --- |
| `TOKEN` | Discord bot token |
| `USER_ID` | Discord bot user ID used by player initialization |
| `PORT` | HTTP and Socket.IO listening port |
| `BASE_URL` | Public origin used to construct dashboard links |
| `NODE_ENV` | Runtime environment; development mode appends `:<PORT>` to `BASE_URL` |
| `DASHBOARD_TOKEN` | JWT signing/verifying secret |

Never commit `.env` or real credentials. The bot does not require Administrator permission. Audio runtime requirements should follow the installed Discord Player/extractor versions.

Useful scripts from `package.json`:

- `yarn dev` — start CommandKit development mode.
- `yarn build` — type-check and create the production build.
- `yarn start` — start the production build.

There is currently no automated test script. Run `yarn build` after code changes. No dashboard frontend or filter-control API is currently implemented.