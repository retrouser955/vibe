import { ChatInputCommandContext } from "commandkit";
import { ApplicationCommandOptionType, Colors, EmbedBuilder, MessageFlags, SendableChannels } from "discord.js";
import { player } from "../../createPlayer.ts";
import { QueueMetadata } from "@/lib/types.ts";
import { createMusicEmbed } from "@/lib/embeds.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";

$: SlashCommand("Play a track depending on given name")
export default async function play({ interaction }: ChatInputCommandContext) {
  const query = $param(ApplicationCommandOptionType.String, {
    required: true,
    description: "The name of the track you want to play"
  })

  const values = await guardMusicCommand(interaction);
  if(!values) return;

  const { channel, textChannel } = values;

  await interaction.reply(`🔃 | Searching for track \`${query}\``);

  const searchResult = await player.search(query!, {
    requestedBy: interaction.user.id
  });

  const track = searchResult.tracks.at(0);

  if (!track) {
    return void interaction.editReply("❎ | No track with the matching query found. Please refine your query")
  }

  const displayText = `**[${track.title}](<${track.url}>)**\n` +
    `**Duration**: \`${track.duration}\`\n` +
    `**Artist**: \`${track.author}\``;

  const container = new EmbedBuilder()
    .setTitle("A track is being loaded!")
    .setDescription(displayText)
    .setThumbnail(track.thumbnail)
    .setColor(Colors.Blue);

  await interaction.editReply({
    content: "",
    embeds: [container]
  })

  const result = await player.play<QueueMetadata>(channel, track, {
    nodeOptions: {
      metadata: {
        channel: textChannel as unknown as SendableChannels, // ????
      }
    }
  });

  if (result.playerResult) {
    return void interaction.editReply({
      embeds: [createMusicEmbed(track)],
    })
  }

  return void interaction.editReply({
    embeds: [createMusicEmbed(track, result.queue)]
  })
}