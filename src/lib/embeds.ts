import type { GuildQueue, Track } from "discord-player";
import { Colors, EmbedBuilder } from "discord.js";

export function createMusicEmbed(track: Track, queue?: GuildQueue, titleOverride?: string) {
    const duration = `Duration: \`${track.duration}\``;
    const author = `Artist: **${track.author}**`;
    const description = `**${track.title}**\n${duration}\n${author}`;

    const embed = new EmbedBuilder()
        .setTitle(titleOverride ?? `A new track ${queue ? "was queued" : "is starting"}`)
        .setDescription(description)
        .setThumbnail(track.thumbnail)
        .setColor(Colors.Blue);

    if(queue) {
        embed.setFooter({
            text: `Queued at position ${queue.getSize()}`
        })
    }

    return embed;
}