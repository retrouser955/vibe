import { createMusicEmbed } from "@/lib/embeds.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";

$: SlashCommand("Check what song is playing right now")
export default async function nowplaying({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if (!values) return;

    const { queue } = values;
    const track = queue.currentTrack;

    if (!track) return void interaction.reply({
        content: "❎ | There are no tracks playing",
        flags: MessageFlags.Ephemeral
    });

    await interaction.deferReply();
    const embed = createMusicEmbed(track, undefined, "Now Playing.");

    embed.setDescription(`${embed.data.description}\n${queue.node.createProgressBar()}`);

    await interaction.followUp({
        embeds: [embed]
    });
}