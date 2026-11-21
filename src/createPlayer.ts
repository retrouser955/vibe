import { DiscordPlayer, GuildQueueEventsMap, serialize, Track } from "discord-player";
import { lrclibPlugin } from "@discord-player/plugin-host";
import client from "./app.js";
import { YoutubeExtractor } from "discord-player-youtubei";
import { Events } from "discord.js";
import { Logger } from "commandkit";
import { SpotifyExtractor } from "discord-player-spotify";
import { GuildQueue } from "discord-player";
import { io } from "@/server/socket.ts";
import { Colors } from "discord.js";
import { QueueMetadata } from "./lib/types.ts";
import { createMusicEmbed } from "./lib/embeds.ts";
import { emitAudioFilters } from "./lib/filters.ts";
import { BaseExtractor } from "discord-player";

export const player = new DiscordPlayer({
    nodes: [
        {
            type: "embedded",
            id: "embedded-1"
        }
    ],
    async send(guildId, payload) {
        client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    plugins: [lrclibPlugin()]
});

player.initialize(process.env['USER_ID']!).then(() => {
    Logger.info("Player has loaded");
});

const activeLyricsRequests = new Map<string, object>();
const activeLyricsSubscriptions = new Map<string, () => void>();

player.events.on("playerStart", async (queueUntyped, track) => {
    const queue = queueUntyped as GuildQueue<QueueMetadata>;
    const requestToken = {};
    activeLyricsRequests.set(queue.guildId, requestToken);

    queue.metadata.channel.send({
        embeds: [createMusicEmbed(track)]
    });

    io.to(`guild:${queue.guildId}`).emit("playerStart", serialize(track));

    const lyrics = (await player.lyrics.search(track)).at(0);
    if (activeLyricsRequests.get(queue.guildId) !== requestToken) return;

    if (lyrics?.synced) {
        activeLyricsSubscriptions.get(queue.guildId)?.();
        queue.syncedLyrics.load(lyrics);
        const unsubscribe = queue.syncedLyrics.subscribe((line, timestamp) => {
            if (activeLyricsRequests.get(queue.guildId) !== requestToken) return;

            io.to(`guild:${queue.guildId}`).emit("lyricsUpdate", {
                line,
                timestamp
            });
        });
        activeLyricsSubscriptions.set(queue.guildId, unsubscribe);
    }
});

const emitAudioTrackUpdate = (eventName: string, queue: GuildQueue, track: Track | Track[]) => {
    io.to(`guild:${queue.guildId}`)
        .emit(
            eventName,
            Array.isArray(track) ? track.map(v => serialize(v)) : serialize(track)
        );
}

(["audioTrackAdd", "audioTrackRemove", "audioTracksRemove", "audioTracksAdd"] as (keyof GuildQueueEventsMap)[]).forEach(v => {
    player.events.on(v, (...args: [GuildQueue, Track | Track[]]) => emitAudioTrackUpdate(v, ...args))
});

player.events.on("emptyQueue", async (queue) => {
    activeLyricsRequests.delete(queue.guildId);
    activeLyricsSubscriptions.get(queue.guildId)?.();
    activeLyricsSubscriptions.delete(queue.guildId);

    const guild = client.guilds.cache.get(queue.guildId);

    (queue.metadata as QueueMetadata).channel.send({
        embeds: [
            {
                title: "Queue has finished!",
                description: `The queue in ${guild ? `**${guild.name}**` : "the current guild"} has finished! Disconnecting...`,
                color: Colors.Blue
            }
        ]
    })

    await player.deleteQueue(queue.guildId);

    io.to(`guild:${queue.guildId}`).emit("emptyQueue");
});

player.events.on("audioFiltersUpdate", (queue) => {
    emitAudioFilters(queue);
});


function updateProgress(queue: GuildQueue, eventName: string) {
    const progress = queue.node.getTimestamp()!;
    io.to(`guild:${queue.guildId}`).emit(eventName, progress);
}

player.events.on("playerPause", (queue) => updateProgress(queue, "playerPause"));
player.events.on("playerResume", (queue) => updateProgress(queue, "playerResume"));

client.on(Events.Raw, (payload) => player.receive(payload));

player.extractors.register(SpotifyExtractor);
player.extractors.register(YoutubeExtractor, {
    bridge: {
        from: "yt-music",
        createQuery: (track) => `${track.title} by ${track.author}`
    }
});