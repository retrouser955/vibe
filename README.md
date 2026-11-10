# Vibe

Vibe is a Discord music bot with an Express API and Socket.IO backend, plus a React dashboard built with Vite. The backend uses Discord.js, CommandKit, YangonKit, and `discord-player` v8.

## Features

- `/play <query>` searches and plays the first matching track in the caller's voice channel.
- `/skip` skips the current track.
- `/web` creates a private, three-hour dashboard session link scoped to the current user and guild.
- The dashboard frontend lives in `dashboard/` and uses React, TypeScript, Vite, and `socket.io-client`.
- YouTube and Spotify search/playback extractors are registered with Discord Player.
- Authenticated API endpoints expose user, guild, search, and queue operations.
- Socket.IO connections are authenticated with the dashboard JWT and receive guild-scoped player events.

## Requirements

- Node.js compatible with the installed dependencies and Yarn.
- A Discord application and bot invited to a server.
- The audio dependencies/runtime required by Discord Player, including its supported FFmpeg setup.

The bot requests the `Guilds` and `GuildVoiceStates` intents. Grant only the permissions it needs: application command use, voice connect/speak, and sending messages and embeds. Administrator permission is not required.

## Setup

Install backend and dashboard dependencies separately:

```sh
yarn install
cd dashboard
yarn install
cd ..
```

Copy `.env.example` to `.env` and set the values described below. Generate a strong secret for `DASHBOARD_TOKEN`, for example:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Development

Run the backend and frontend in separate terminals. From the repository root, start the bot and Express API:

```sh
yarn dev
```

In another terminal, start Vite:

```sh
cd dashboard
yarn dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The Vite config proxies `/api` and `/socket.io` to `http://localhost:3000` by default. Set `BACKEND_URL` in the dashboard environment if the Express server uses a different URL. Frontend requests should use relative `/api` paths, and Socket.IO should connect to the current origin so both use this proxy.

The `/web` command currently builds a link to the Express origin. Express currently mounts the API but does not yet serve the Vite build, so that link does not open the dashboard during development. Open the Vite URL instead when working on the frontend. The frontend reads the `session` query parameter, removes it from the address bar, and stores the JWT in `localStorage` under `dashboardToken`.

For builds, run `yarn build` at the repository root for the backend and `yarn build` in `dashboard/` for the frontend. The frontend build is written to `dashboard/dist`. The Express static-file hosting and SPA fallback still need to be wired up before the dashboard is served by Express in production.

Keep `.env`, bot credentials, JWT secrets, and generated dashboard links private. The dashboard link contains a bearer token and can be used by anyone who obtains it until it expires.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `TOKEN` | Yes | Discord bot token used by CommandKit/Discord.js. |
| `USER_ID` | Yes | Discord bot user ID, passed to Discord Player initialization. |
| `PORT` | Yes | Port used by the Express and Socket.IO HTTP server. |
| `BASE_URL` | Yes | Public origin. In development, `:<PORT>` is appended; otherwise this value is used as-is. |
| `NODE_ENV` | Yes | Use `development` locally; use a production value in deployment. |
| `DASHBOARD_TOKEN` | Yes | Secret used to sign and verify dashboard JWTs. Use a long random value. |

The example values (`BASE_URL=http://localhost`, `PORT=3000`) produce `http://localhost:3000` in development. In production, set `BASE_URL` to the externally reachable origin, normally using HTTPS, and proxy HTTP and WebSocket traffic to `PORT`.

## Discord commands

### `/play <query>`

Requires the user to be in a joinable voice channel and the bot to be able to send messages in the command channel. The bot rejects requests if it is already connected to a different voice channel in the guild.

### `/skip`

Requires an existing queue and the user to share the bot's voice channel. It skips the current track; if no track is playing, the command replies ephemerally.

### `/web`

Creates an ephemeral link containing a JWT with the user's and guild's IDs. The token expires after three hours. Treat the full link as a secret.

### `/queue`

Lists the current queue. Shows the next 10 upcoming tracks with links, and notes how many more are beyond that. Requires an existing queue.

### `/stop`

Stops and destroys the current queue for the guild. Requires an existing queue and the user to share the bot's voice channel.

## HTTP API

All endpoints are mounted under `/api` and require:

```http
Authorization: Bearer <dashboard-jwt>
```

Missing, invalid, or expired tokens receive `401 Unauthorized`. The JWT is generated by `/web` and scopes requests to its user and guild claims.

| Method and path | Description |
| --- | --- |
| `GET /api/me` | Fetches the token's Discord user and adds `userAvatarURL`. |
| `GET /api/guild` | Fetches the token's guild and adds `guildIconURL`. |
| `GET /api/search?query=<text>` | Searches on behalf of the token's user and returns up to five serialized results. A missing or non-string query returns `400`; search errors return an empty array. |
| `GET /api/queue/current` | Returns the current track, or `404` if there is no current track/queue. |
| `GET /api/queue?offset=0` | Returns `{ size, tracks }`, with up to 20 queued tracks starting at the requested offset. Invalid offsets return `400`; a missing queue/current track returns `404`. |
| `POST /api/queue` | Adds a serialized track to an existing guild queue. The JSON body must be compatible with the server's `deserialize` call. Returns `{ position }`; invalid payloads or playlists return `400`, and a missing queue returns `404`. |
| `POST /api/queue/skip` | Skips the current track. Returns `204 No Content` on success, `404` if the guild has no queue, and `409` if the queue has no current track. |
| `POST /api/queue/stop` | Stops and destroys the guild queue. Returns `204 No Content` on success, `404` if the guild has no queue. |

Track responses use serialization provided by the libraries in the route handlers. Clients should follow the actual serialized payload shape rather than treating responses as live Discord Player class instances.

## Socket.IO

Socket.IO shares the Express HTTP server. Pass the dashboard JWT in the connection handshake:

```js
const socket = io(serverUrl, {
	auth: { token: dashboardToken }
});
```

After verification, the connection joins `guild:<guild-id>`. Current events are:

| Event | Payload |
| --- | --- |
| `playerStart` | The starting track's serialized representation. |
| `audioTrackAdd` | A serialized Track added to the upcoming queue. |
| `audioTracksAdd` | An array of serialized Tracks added to the upcoming queue. |
| `audioTrackRemove` | A serialized Track removed from the upcoming queue. |
| `audioTracksRemove` | An array of serialized Tracks removed from the upcoming queue. |
| `emptyQueue` | No payload; the guild queue has finished. |
| `playerPause` / `playerResume` | Playback timestamp/progress from Discord Player. |

Serialized track payloads have this shape:

```json
{
  "type": "track",
  "version": 1,
  "data": {
    "sourceReference": {
      "pluginId": "...",
      "data": "..."
    },
    "id": "...",
    "title": "...",
    "author": "...",
    "description": "...",
    "url": "...",
    "thumbnail": "...",
    "durationMS": 180000,
    "views": 1000,
    "requestedBy": "...",
    "source": "...",
    "live": false,
    "metadata": null
  }
}
```

`sourceReference` is omitted when the track was not resolved by a source plugin. `requestedBy` is the requester's user ID or `null`. `metadata` is JSON-safe application metadata or `null`.

Use the same JWT for API requests and Socket.IO authentication. Avoid logging or exposing it. During development, Vite proxies both API and Socket.IO traffic to Express. In production, the intended setup is to serve the frontend and API from the same origin; use HTTPS/WSS.

## Project structure

```text
src/
	app.ts                         Discord.js client
	createPlayer.ts                Discord Player setup, extractors, and events
	app/commands/                  Slash command handlers
	app/events/clientReady/        Client-ready event handlers
	lib/                           Shared embeds, filters, guards, types, URL helper
	server/server.ts               Express and Socket.IO server startup
	server/socket.ts               Shared Socket.IO instance
	server/api/                    API router, authentication, and route handlers
	web/createSecureToken.ts       Dashboard JWT generation and verification
```

`commandkit.config.ts` enables YangonKit macros for slash command declarations. TypeScript's `@/*` alias maps to `src/*`.

## Development notes

- API route files register handlers as side effects; `src/server/api/index.ts` imports them and exports the shared router.
- `src/server/socket.ts` owns the shared Socket.IO instance to keep it separate from server startup and API route imports.
- `src/server/server.ts` enables JSON request parsing, attaches Socket.IO, mounts the API, and starts listening.
- The React/Vite frontend is a separate package under `dashboard/`; its dev server proxies API and Socket.IO traffic to Express. Production static hosting is not yet configured in Express.
- `src/lib/filters.ts` contains filter presets, but they are not currently exposed through commands or API routes.
- There is no test script in the root `package.json`; the root `yarn build` runs the CommandKit build and type checking. The dashboard has its own build script, which type-checks and builds with Vite.