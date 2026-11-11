import type { GuildQueue, Track } from "discord-player";
import { Colors, EmbedBuilder } from "discord.js";

const FF_FILTER_CLEAR = "🎧 Cleared all audio playback filters.";

export function createMusicEmbed(track: Track, queue?: GuildQueue, titleOverride?: string) {
    const duration = `Duration: \`${track.duration}\``;
    const author = `Artist: **${track.author}**`;
    const description = `**[${track.title}](${track.url})**\n${duration}\n${author}`;

    const embed = new EmbedBuilder()
        .setTitle(titleOverride ?? `A new track ${queue ? "was queued" : "is starting"}`)
        .setDescription(description)
        .setThumbnail(track.thumbnail)
        .setColor(Colors.Blue);

    if (queue) {
        embed.setFooter({
            text: `Queued at position ${queue.getSize()}`
        })
    }

    return embed;
}

export function createAudioFilterEmbed(queue: GuildQueue) {
    const embed = new EmbedBuilder()
        .setTitle("Audio Playback Filters")
        .setDescription(
            queue.node.filters.enabled.length === 0 ?
                FF_FILTER_CLEAR :
                "**🤘 Enabled audio filters**\n" + queue.node.filters.enabled
                    .map((v) => `- ${v}`)
                    .join("\n")
        )
        .setColor(Colors.Blue);
    
    return embed;
}