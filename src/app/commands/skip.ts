import { createMusicEmbed } from "@/lib/embeds.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";

$: SlashCommand("Skip the current track.")
export default async function skip({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if(!values) return;

    const { queue } = values;
    const track = queue.currentTrack;

    if(!track) return void interaction.reply({
        content: "❎ | There are no tracks playing",
        flags: MessageFlags.Ephemeral
    })

    await interaction.deferReply();

    await queue.skip();

    await interaction.followUp({
        embeds: [createMusicEmbed(track, undefined, "Skipped the current track.")]
    });
}