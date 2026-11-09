import { DiscordPlayer } from "discord-player";
import client from "./app.js";
import { YoutubeExtractor } from "discord-player-youtubei";
import { Events } from "discord.js";
import { Logger } from "commandkit";
import { SpotifyExtractor } from "discord-player-spotify";
import { GuildQueue } from "discord-player";
import { io } from "@/server/server.ts";
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

player.initialize(process.env['USER_ID']!).then(() => {
    Logger.info("Player has loaded");
});

player.events.on("playerStart", async (queueUntyped, track) => {
    const queue = queueUntyped as GuildQueue<QueueMetadata>;

    queue.metadata.channel.send({
        embeds: [createMusicEmbed(track)]
    });

    io.to(`guild:${queue.guildId}`).emit("playerStart", track.toJSON());
})

player.events.on("emptyQueue", (queue) => {
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

    io.to(`guild:${queue.guildId}`).emit("emptyQueue");

    queue.destroy();
});

client.on(Events.Raw, (payload) => player.receive(payload));

player.extractors.register(SpotifyExtractor);
player.extractors.register(YoutubeExtractor);