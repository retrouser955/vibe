import { createAudioFilterEmbed } from "@/lib/embeds.ts";
import { emitAudioFilters, FFMPEG_AUDIO_FILTERS, FILTERS_OFF } from "@/lib/filters.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { AudioFilterName } from "discord-player";
import { ApplicationCommandOptionType } from "discord.js";

const FF_FILTER_CHOICES = Object.keys(FFMPEG_AUDIO_FILTERS).map((v) => ({
    name: v,
    value: v
}));

$: SlashCommand("Toggle playback audio filters.")
export default async function filter({ interaction }: ChatInputCommandContext) {
    const name = $param(ApplicationCommandOptionType.String, {
        required: true,
        choices: [
            ...FF_FILTER_CHOICES,
            { name: FILTERS_OFF, value: FILTERS_OFF }
        ],
        description: "The filter you want to toggle"
    });

    const values = await guardMusicCommand(interaction, true);
    if(!values) return;

    await interaction.deferReply();

    const { queue } = values;
    if(name === FILTERS_OFF) {
        await queue.node.filters.clear();
        emitAudioFilters(queue);
        return void interaction.followUp({
            embeds: [createAudioFilterEmbed(queue)]
        });
    }

    await queue.node.filters.toggle(name as AudioFilterName);
    emitAudioFilters(queue);
    void interaction.followUp({
        embeds: [createAudioFilterEmbed(queue)]
    });
}