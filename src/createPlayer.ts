import { DiscordPlayer, GuildQueueEvents, GuildQueueEventsMap, serialize, Track } from "discord-player";
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

export const player = new DiscordPlayer({
    nodes: [
        {
            type: "embedded",
            id: "embedded-1"
        }
    ],
    async send(guildId, payload) {
        client.guilds.cache.get(guildId)?.shard?.send(payload);
    }
});

// TODO: Removed this monkey-patch after discord-player releases a new version.
DiscordPlayer.prototype.deleteQueue = async function (...args) {
    const queue = this.getQueue(args[0]);
    const session = queue?.node?.session;
    try {
        return await this.queues.delete(args[0]);
    } finally {
        session?.dispose();
    }
}

player.initialize(process.env['USER_ID']!).then(() => {
    Logger.info("Player has loaded");
});

player.events.on("playerStart", async (queueUntyped, track) => {
    const queue = queueUntyped as GuildQueue<QueueMetadata>;

    queue.metadata.channel.send({
        embeds: [createMusicEmbed(track)]
    });

    io.to(`guild:${queue.guildId}`).emit("playerStart", serialize(track));
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
    const guild = client.guilds.cache.get(queue.guildId);

    (queue.metadata as QueueMetadata).channel.send({
        embeds: [
            {
                title: "Queue has finished!",
                description: `The queue in ${guild ? `**${guild.name}**` : "the current guild"} has finished!. Disconnecting...`,
                color: Colors.Blue
            }
        ]
    })

    await player.deleteQueue(queue.guildId);

    io.to(`guild:${queue.guildId}`).emit("emptyQueue");
});


function updateProgress(queue: GuildQueue, eventName: string) {
    const progress = queue.node.getTimestamp()!;
    io.to(`guild:${queue.guildId}`).emit(eventName, progress);
}

player.events.on("playerPause", (queue) => updateProgress(queue, "playerPause"));
player.events.on("playerResume", (queue) => updateProgress(queue, "playerResume"));

client.on(Events.Raw, (payload) => player.receive(payload));

player.extractors.register(SpotifyExtractor);
player.extractors.register(YoutubeExtractor);