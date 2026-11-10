import { createMusicEmbed } from "@/lib/embeds.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";

$: SlashCommand("Pause the current playback.")
export default async function pause({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if (!values) return;

    const { queue } = values;
    const track = queue.currentTrack;

    if (!track) return void interaction.reply({
        content: "❎ | There are no tracks playing",
        flags: MessageFlags.Ephemeral
    });

    if (queue.node.isPaused()) return void interaction.reply({
        content: "❎ | The queue is already paused",
        flags: MessageFlags.Ephemeral
    });

    await interaction.deferReply();

    await queue.node.pause();

    await interaction.followUp({
        embeds: [createMusicEmbed(track, undefined, "Paused the current track.")]
    });
}