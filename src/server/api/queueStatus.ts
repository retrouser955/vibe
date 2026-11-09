import { authenticateJWT } from "./authenticateJWT.ts";
import { api } from "./router.ts";
import { player } from "@/createPlayer.ts";
import { serialize } from "discord-player";

api.get("/current", authenticateJWT, async (_, res) => {
    const claims = res.locals.auth;
    const queue = player.getQueue(claims.guild);

    if (!queue || !queue.currentTrack) return res.status(404).json({
        message: "A queue or the current track with that guild was not found."
    });

    res.json(serialize(queue.currentTrack));
});

api.get("/queue", authenticateJWT, async (req, res) => {
    const claims = res.locals.auth;
    const offset = req.query.offset ?? "0";
    if(typeof offset !== "string" || Number.isNaN(parseInt(offset))) return res.status(400).json({
        message: "Bad offset value"
    });

    const offsetParsed = parseInt(offset);

    const queue = player.getQueue(claims.guild);

    if (!queue || !queue.currentTrack) return res.status(404).json({
        message: "A queue or the current track with that guild was not found."
    });

    const size = queue.getSize();

    res.json({
        size,
        // send 20 tracks each time
        tracks: queue.tracks.toArray().slice(offsetParsed, offsetParsed + 20).map(serialize)
    });
});