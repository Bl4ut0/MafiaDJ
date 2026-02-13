import { Client, DMChannel, Message, User, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { LibraryDMState } from '../../database/LibraryDMState';
import { MainView } from './MainView';
// import { PlaylistsView } from './PlaylistsView';
// import { TrackDetailView } from './TrackDetailView';

export class LibraryManager {
    public static async openLibrary(user: User) {
        // Check existing state
        let state = LibraryDMState.get(user.id);

        if (state) {
            try {
                // Try to find the channel and message
                const channel = await user.createDM();
                const message = await channel.messages.fetch(state.dmMessageId);
                if (message) {
                    // Refresh view
                    await this.renderView(user, message, state);
                    return;
                }
            } catch (e) {
                // Message deleted or channel inaccessible, reset
            }
        }

        // Create new
        const channel = await user.createDM();
        // Initial View: Main Favorites Page 1
        const viewData = await MainView.render(user.id, 1);
        const message = await channel.send(viewData);

        LibraryDMState.save({
            userId: user.id,
            dmChannelId: channel.id,
            dmMessageId: message.id,
            currentView: 'favorites',
            currentPage: 1
        });
    }

    public static async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
        if (!interaction.customId.startsWith('lib:')) return;

        // Defer update to prevent "interaction failed"
        await interaction.deferUpdate(); // Update: deferUpdate means we will edit the message.

        const user = interaction.user;
        let state = LibraryDMState.get(user.id);
        if (!state) return; // Should not happen if interacting with valid message

        const action = interaction.customId.split(':')[1];

        try {
            if (action === 'page') {
                const newPage = parseInt(interaction.customId.split(':')[2]);
                state.currentPage = newPage;
                state.currentView = 'favorites'; // Ensure view is correct
            }
            if (action === 'view') {
                const target = interaction.customId.split(':')[2];
                // If playlist view, switch view
                // For now, only favorites implemented in MainView
                if (target === 'playlists') {
                    // state.currentView = 'playlists';
                    await interaction.followUp({ content: '📂 Playlists coming soon!', ephemeral: true });
                    return;
                }
            }

            // Save state & re-render
            LibraryDMState.save(state);
            const message = (interaction.message as Message);
            await this.renderView(user, message, state);

        } catch (error) {
            console.error('Library interaction error:', error);
        }
    }

    private static async renderView(user: User, message: Message, state: any) {
        let viewData;

        // Route views
        switch (state.currentView) {
            case 'favorites':
            default:
                viewData = await MainView.render(user.id, state.currentPage);
                break;
        }

        await message.edit(viewData);
    }
}
