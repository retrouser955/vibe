import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { ChatInputCommandContext } from "commandkit";
import { Colors } from "discord.js";

$: SlashCommand("Stops and destorys the current queue")
export default async function stop({ interaction }: ChatInputCommandContext) {
    const values = await guardMusicCommand(interaction, true);
    if(!values) return;

    await values.queue.node.destroySession();
    await values.queue.destroy();

    void interaction.reply({
        embeds: [
            {
                description: `**Destoryed the Queue in the current guild**`,
                color: Colors.Blue
            }
        ]
    });
}