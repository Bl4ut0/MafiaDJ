import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createControllerButtons(isPaused: boolean = false, isLooping: boolean = false, volume: number = 50) {
    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('controller:prev')
                .setLabel('⏮ Prev')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true), // Disabled for now, history not implemented yet
            new ButtonBuilder()
                .setCustomId('controller:pause')
                .setLabel(isPaused ? '▶ Resume' : '⏸ Pause')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('controller:skip')
                .setLabel('⏭ Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('controller:like')
                .setLabel('❤️ Like')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('controller:loop')
                .setLabel(isLooping ? '🔁 Loop: On' : '🔁 Loop: Off')
                .setStyle(isLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('controller:shuffle')
                .setLabel('🔀 Shuffle')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('controller:vol_up')
                .setLabel('🔊 Vol+')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('controller:vol_down')
                .setLabel('🔉 Vol-')
                .setStyle(ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('controller:favorites')
                .setLabel('⭐ Favorites (DM)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('controller:stop')
                .setLabel('⏹ End Session')
                .setStyle(ButtonStyle.Danger)
        );

    return [row1, row2, row3];
}
