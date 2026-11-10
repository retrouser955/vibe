import { api } from "./router.ts";
import { authenticateJWT } from "./authenticateJWT.ts";
import client from "@/app.ts";
import { player } from "@/createPlayer.ts";
import { serialize } from "discord-player";

api.get("/me", authenticateJWT, async (_req, res) => {
    const claims = res.locals.auth;
    const user = await client.users.fetch(claims.user);
    const userJson = user.toJSON() as Record<string, unknown>;
    res.json({
        ...(userJson),
        userAvatarURL: user.displayAvatarURL()
    });
});

api.get("/guild", authenticateJWT, async (_req, res) => {
    const claims = res.locals.auth;
    const guild = await client.guilds.fetch(claims.guild);
    const guildJson = guild.toJSON() as Record<string, unknown>;
    res.json({
        ...guildJson,
        guildIconURL: guild.iconURL()
    });
});

api.get("/search", authenticateJWT, async (req, res) => {
    const { query } = req.query;
    const claims = res.locals.auth;

    if (!query || typeof query !== "string") return res.status(400).json({
        message: "Bad request. Query was not found."
    });

    try {
        const results = await player.search(query, {
            requestedBy: claims.user as string
        });

        return res.json(results.tracks.slice(0, 5).map((value) => serialize(value)));
    } catch (error) {
        return res.json([]);
    }
});