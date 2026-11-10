import { player } from "@/createPlayer.ts";
import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { Colors } from "discord.js";

$: SlashCommand("Stops and destorys the current queue")
export default async function stop({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if(!values) return;

    await player.deleteQueue(values.queue.guildId);

    void interaction.reply({
        embeds: [
            {
                description: `**Destoryed the Queue in the current guild**`,
                color: Colors.Blue
            }
        ]
    });
}