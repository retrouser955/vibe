import { deserialize, Playlist, Track } from "discord-player";
import { api } from "./router.ts";
import { authenticateJWT } from "./authenticateJWT.ts";
import { player } from "@/createPlayer.ts";
import { QueueMetadata } from "@/lib/types.ts";
import { createMusicEmbed } from "@/lib/embeds.ts";

api.post("/queue", authenticateJWT, async (req, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const track = req.body;
    if (!track || typeof track !== "object") return res.status(400).json({
        message: "invalid request body"
    });

    let deserializedTrack: Track;

    try {
        const trackRaw = deserialize(track);
        if (trackRaw instanceof Playlist) return res.status(400).json({
            message: "recieved playlist instead of a track"
        });
        deserializedTrack = trackRaw;
    } catch {
        return res.status(400).json({
            message: "Unable to deseralize the track"
        });
    }

    queue.play(deserializedTrack);

    const embed = createMusicEmbed(track, queue);
    embed.setDescription(`${embed.data.description}\n-# Queued by <@${user}> via 🌐`);

    queue.metadata.channel.send({
        embeds: [embed]
    });

    res.json({
        position: queue.getSize()
    });
});

api.post("/queue/skip", authenticateJWT, async (req, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const track = queue.currentTrack;

    if(!track) return res.status(409).json({
        message: "Invalid queue state"
    });

    queue.skip();

    const embed = createMusicEmbed(track, queue, "The current track was skipped.");
    embed.setDescription(`${embed.data.description}\n-# Skipped by <@${user}> via 🌐`);

    queue.metadata.channel.send({
        embeds: [embed]
    });

    res.sendStatus(204);
});