import { ChatInputCommandContext } from "commandkit";
import { MessageFlags, SendableChannels, VoiceBasedChannel } from "discord.js";
import { QueueMetadata } from "./types.ts";
import { player } from "@/createPlayer.ts";
import { GuildQueue } from "discord-player";

export async function guardMusicCommand<T extends boolean>(
    interaction: ChatInputCommandContext['interaction'],
    guardQueue?: T
): Promise<(T extends true ?
    {
        channel: VoiceBasedChannel,
        textChannel: SendableChannels,
        queue: GuildQueue
    } : 
    {
        channel: VoiceBasedChannel,
        textChannel: SendableChannels,
        queue?: GuildQueue
    }) | undefined>
{
    const member = await interaction.guild!.members.fetch(interaction.member!.user.id);
    const channel = member.voice.channel;

    if (!channel?.joinable) {
        return void interaction.reply({
            content: "❎ | Could not join your voice channel. Please check permissions and make sure you are in a voice channel.",
            flags: MessageFlags.Ephemeral
        })
    }

    const textChannel = interaction.channel;

    if (!textChannel?.isSendable()) {
        return void interaction.reply({
            content: "❎ | I cannot send messages in this channel.",
            flags: MessageFlags.Ephemeral
        })
    }

    const queue = player.getQueue<QueueMetadata>(interaction.guildId!);

    if (queue?.node.session && queue.node.session.channelId !== channel.id) {
        return void interaction.reply({
            content: "❎ | I am already playing. Join my voice channel instead.",
            flags: MessageFlags.Ephemeral
        })
    }

    if (guardQueue && !queue) {
        return void interaction.reply({
            content: "❎ | There are no existing queues in this guild.",
            flags: MessageFlags.Ephemeral
        })
    }

    // @ts-expect-error these errors are expected
    return {
        channel,
        textChannel,
        queue
    }
}