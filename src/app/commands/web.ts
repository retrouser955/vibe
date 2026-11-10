import { guardMusicCommand } from "@/lib/guardMusic.ts";
import { createWebURL } from "@/lib/web.ts";
import { generateJWT } from "@/web/createSecureToken.ts";
import { ChatInputCommandContext } from "commandkit";
import { Colors, EmbedBuilder, MessageFlags } from "discord.js";

$: SlashCommand("Get a live dashboard URL for yourself.")
export default function web({ interaction }: ChatInputCommandContext) {
    const canProceed = guardMusicCommand(interaction, true);

    if(!canProceed) return;

    const jwt = generateJWT(interaction.user.id, interaction.guildId!);

    const siteUrl = `${createWebURL()}/dashboard?session=${jwt}`;

    const siteEmbed = new EmbedBuilder()
        .setDescription(`**Website URL created**\nPlease click [this link](${siteUrl}) to see the dashboard`)
        .setFooter({ text: "Do not share this link with anyone." })
        .setColor(Colors.Blue);
    
    void interaction.reply({
        embeds: [siteEmbed],
        flags: MessageFlags.Ephemeral
    })
}