import { AudioFilter } from "discord-player";
import type { GuildQueue } from "discord-player";
import { io } from "@/server/socket.ts";

export const FFMPEG_AUDIO_FILTERS = {
    "Surround": [
        "apulsator=hz=0.09"
    ],

    "8D": [
        "apulsator=mode=sine:hz=0.125:amount=0.6",
        "crossfeed=strength=0.4",
        "aecho=0.9:0.9:40|70:0.15|0.1",
    ],

    "16D": [
        "acrossover=split=250 2500:order=4th[lo][mid][hi];" +
        "[lo]apulsator=mode=sine:hz=0.05:amount=0.3[lo2];" +
        "[mid]apulsator=mode=sine:hz=0.11:amount=0.6:offset_l=0:offset_r=0.5[mid2];" +
        "[hi]apulsator=mode=sine:hz=0.17:amount=0.6:offset_l=0.25:offset_r=0.75[hi2];" +
        "[lo2][mid2][hi2]amix=inputs=3:normalize=0",
        "crossfeed=strength=0.4",
        "lowpass=f=4000",
        "aecho=0.9:0.9:40|70:0.15|0.1",
        "bass=g=2:f=100:w=0.6"
    ],

    Vaporwave: [
        "asetrate=38400",
        "aresample=48000",
        "aecho=0.8:0.88:60:0.4"
    ],

    Nightcore: [
        "asetrate=60000",
        "aresample=48000"
    ],

    LoFi: [
        "asetrate=43200",
        "aresample=48000",
        "extrastereo=m=2.5:c=disabled"
    ],

    Underwater: [
        "lowpass=f=600",
        "aecho=0.8:0.7:40:0.5"
    ]
} as const;

for (const [name, graph] of Object.entries(FFMPEG_AUDIO_FILTERS)) {
    AudioFilter.define(name, graph.join(","));
}

/** Names of every filter preset this bot registers. */
export const FFMPEG_AUDIO_FILTER_NAMES = Object.keys(FFMPEG_AUDIO_FILTERS);

/** Sentinel used by the filter endpoints to disable every filter. */
export const FILTERS_OFF = "Off";

/** Whether a value names one of the registered filter presets. */
export function isFFmpegAudioFilter(value: unknown): value is string {
    return typeof value === "string" && FFMPEG_AUDIO_FILTER_NAMES.includes(value);
}

/** Enabled preset names for a queue, in application order. */
export function getEnabledAudioFilters(queue: GuildQueue): string[] {
    return [...queue.node.filters.enabled];
}

/** Broadcast a queue's filter state to the dashboard clients in its guild. */
export function emitAudioFilters(queue: GuildQueue) {
    io.to(`guild:${queue.guildId}`).emit("audioFiltersUpdate", {
        filtersEnabled: getEnabledAudioFilters(queue)
    });
}
