import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { Colors, EmbedBuilder } from "discord.js";

$: SlashCommand("List the current queue")
export default async function queue({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if(!values) return;
    const { queue } = values;

    const upcoming = queue.tracks.toArray();
    const lines = upcoming.slice(0, 10).map((track, index) => `${index + 1}. [${track.title}](${track.url})`);
    
    await interaction.deferReply();

    const embed = new EmbedBuilder()
        .setTitle(`📋 Queue: ${interaction.guild?.name}`)
        .setDescription(lines.join("\n"))
        .setColor(Colors.Blue);
    
    if(upcoming.length > 10) embed.setFooter({ text: `... and ${upcoming.length - 10} more` });

    await interaction.followUp({
        embeds: [embed]
    });
}