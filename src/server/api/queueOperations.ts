import { AudioFilterName, deserialize, Playlist, Track } from "discord-player";
import { api } from "./router.ts";
import { authenticateJWT } from "./authenticateJWT.ts";
import { player } from "@/createPlayer.ts";
import { QueueMetadata } from "@/lib/types.ts";
import { createAudioFilterEmbed, createMusicEmbed } from "@/lib/embeds.ts";
import { Colors, EmbedBuilder } from "discord.js";
import {
    emitAudioFilters,
    FILTERS_OFF,
    FFMPEG_AUDIO_FILTER_NAMES,
    getEnabledAudioFilters,
    isFFmpegAudioFilter
} from "@/lib/filters.ts";

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

    const embed = createMusicEmbed(deserializedTrack, queue);
    embed.setDescription(`${embed.data.description}\n-# Queued by <@${user}> via 🌐`);

    queue.metadata.channel.send({
        embeds: [embed]
    });

    res.json({
        position: queue.getSize()
    });
});

api.post("/queue/toggle-pause", authenticateJWT, async (_, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const track = queue.currentTrack;

    if (!track) return res.status(409).json({
        message: "Invalid queue state"
    });

    const isPaused = queue.node.isPaused();
    const playbackState = isPaused ? "resumed" : "paused";

    isPaused ? queue.node.resume() : queue.node.pause();

    const embed = createMusicEmbed(track, queue, `The current track was ${playbackState}.`);
    embed.setDescription(`${embed.data.description}\n-# ${playbackState} by <@${user}> via 🌐`);

    queue.metadata.channel.send({
        embeds: [embed]
    });

    res.json({
        playbackState
    });
});

api.post("/queue/skip", authenticateJWT, async (_, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const track = queue.currentTrack;

    if (!track) return res.status(409).json({
        message: "Invalid queue state"
    });

    await queue.skip();

    const embed = createMusicEmbed(track, queue, "The current track was skipped.");
    embed.setDescription(`${embed.data.description}\n-# Skipped by <@${user}> via 🌐`);

    queue.metadata.channel.send({
        embeds: [embed]
    });

    res.sendStatus(204);
});

api.get("/queue/filters", authenticateJWT, async (_, res) => {
    const { guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);

    res.json({
        available: FFMPEG_AUDIO_FILTER_NAMES,
        enabled: queue ? getEnabledAudioFilters(queue) : []
    });
});

api.post("/queue/filters", authenticateJWT, async (req, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const channel = queue.metadata.channel;

    if (!queue.currentTrack) return res.status(409).json({
        message: "Invalid queue state"
    });

    const body = req.body;
    // express.json() rejects bare primitives, so the dashboard sends { filter }.
    const filter = typeof body === "string" ? body : body?.filter;
    if (filter === FILTERS_OFF) {
        await queue.node.filters.clear();
    } else if (isFFmpegAudioFilter(filter)) {
        await queue.node.filters.toggle(filter as AudioFilterName);
    } else {
        return res.status(400).json({
            message: "Invalid queue filters"
        });
    }

    const embed = createAudioFilterEmbed(queue);
    embed.setDescription(`${embed.data.description}\n-# Toggled by <@${user}> via 🌐`);

    await channel.send({
        embeds: [embed]
    });

    const filtersEnabled = getEnabledAudioFilters(queue);
    emitAudioFilters(queue);

    res.json({ filtersEnabled });
});

api.post("/queue/stop", authenticateJWT, async (_, res) => {
    const { user, guild } = res.locals.auth;
    const queue = player.getQueue<QueueMetadata>(guild);
    if (!queue) return res.status(404).json({
        message: "Could not find that guild"
    });

    const channel = queue.metadata.channel;

    await player.deleteQueue(queue.guildId);

    const embed = new EmbedBuilder()
        .setTitle("Queue was stopped")
        .setDescription(`The queue in the current guild was stopped.\n-# Stopped by <@${user}> via 🌐`)
        .setColor(Colors.Blue);

    channel.send({
        embeds: [embed]
    });

    res.sendStatus(204);
})