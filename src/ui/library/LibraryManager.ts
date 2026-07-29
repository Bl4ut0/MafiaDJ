import { Message, User, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
import { LibraryDMState } from '../../database/LibraryDMState';
import { MainView } from './MainView';
import { PlaylistsView } from './PlaylistsView';
import { PlaylistDetailView } from './PlaylistDetailView';
import { HistoryView } from './HistoryView';
import { TrackDetailView } from './TrackDetailView';
import { PersonalPlaylists } from '../../database/PersonalPlaylists';
import { History } from '../../database/History';
import { Favorites } from '../../database/Favorites';
import PlayerManager from '../../player/PlayerManager';
import client from '../../bot/client';
import { config } from '../../config';

export class LibraryManager {
    public static async openLibrary(user: User) {
        const state = LibraryDMState.get(user.id);
        if (state) {
            try {
                const channel = await user.createDM();
                const message = await channel.messages.fetch(state.dmMessageId);
                await this.renderView(user, message, state);
                return;
            } catch {
                // Recreate the library message below.
            }
        }

        const channel = await user.createDM();
        const message = await channel.send(await MainView.render(user.id, 1));
        LibraryDMState.save({
            userId: user.id,
            dmChannelId: channel.id,
            dmMessageId: message.id,
            currentView: 'favorites',
            currentPage: 1,
        });
    }

    public static async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
        if (!interaction.customId.startsWith('lib:')) return;
        await interaction.deferUpdate();

        const state = LibraryDMState.get(interaction.user.id);
        if (!state) return;
        const parts = interaction.customId.split(':');
        const action = parts[1];

        try {
            if (action === 'page') {
                state.currentPage = Math.max(1, Number.parseInt(parts[2], 10) || 1);
                state.currentView = 'favorites';
            } else if (action === 'view') {
                const target = parts[2];
                state.currentView = (['favorites', 'playlists', 'history'].includes(target)
                    ? target
                    : 'favorites') as typeof state.currentView;
                state.currentPage = 1;
            } else if (action === 'playlist_select' && interaction.isStringSelectMenu()) {
                state.currentPlaylistId = Number.parseInt(interaction.values[0], 10);
                state.currentView = 'playlist_detail';
                state.currentPage = 1;
            } else if (action === 'select_track' && interaction.isStringSelectMenu()) {
                state.currentTrackId = Number.parseInt(interaction.values[0], 10);
                state.currentView = 'track_detail';
            } else if (action === 'remove_fav') {
                Favorites.removeById(Number.parseInt(parts[2], 10), interaction.user.id);
                state.currentView = 'favorites';
                state.currentTrackId = undefined;
            } else if (action === 'add_to_playlist' && interaction.isStringSelectMenu()) {
                PersonalPlaylists.addTrack(
                    Number.parseInt(interaction.values[0], 10),
                    Number.parseInt(parts[2], 10),
                    interaction.user.id
                );
            } else if (action === 'play_track') {
                const favorite = Favorites.getById(Number.parseInt(parts[2], 10), interaction.user.id);
                if (favorite) await this.queueFavorite(interaction, favorite);
            } else if (action === 'playlist_page') {
                state.currentPlaylistId = Number.parseInt(parts[2], 10);
                state.currentPage = Math.max(1, Number.parseInt(parts[3], 10) || 1);
                state.currentView = 'playlist_detail';
            } else if (action === 'playlist_delete') {
                PersonalPlaylists.delete(Number.parseInt(parts[2], 10), interaction.user.id);
                state.currentView = 'playlists';
                state.currentPlaylistId = undefined;
                state.currentPage = 1;
            } else if (action === 'playlist_import' || action === 'playlist_shuffle') {
                await this.importPlaylist(interaction, Number.parseInt(parts[2], 10), action === 'playlist_shuffle');
            } else if (action === 'history_page') {
                state.currentView = 'history';
                state.currentPage = Math.max(1, Number.parseInt(parts[2], 10) || 1);
            } else if (action === 'history_add_fav' && interaction.isStringSelectMenu()) {
                const track = History.getUserRecent(interaction.user.id, 100, 0)
                    .find((item: any) => String(item.id) === interaction.values[0]) as any;
                if (track) {
                    Favorites.add(interaction.user.id, {
                        ...track,
                        requesterId: interaction.user.id,
                        addedAt: Date.now(),
                    });
                }
            } else if (action === 'create_playlist') {
                await interaction.followUp({
                    content: 'Create and name playlists in the web dashboard, then import them here.',
                    ephemeral: true,
                });
            }

            LibraryDMState.save(state);
            await this.renderView(interaction.user, interaction.message as Message, state);
        } catch (error) {
            console.error('Library interaction error:', error);
            await interaction.followUp({ content: 'The library action could not be completed.', ephemeral: true });
        }
    }

    private static async importPlaylist(
        interaction: ButtonInteraction | StringSelectMenuInteraction,
        playlistId: number,
        shuffle: boolean
    ) {
        const guild = client.guilds.cache.get(config.guildId);
        const member = await guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;
        if (!guild || !member || !voiceChannel) {
            await interaction.followUp({ content: 'Join a voice channel in the server first.', ephemeral: true });
            return;
        }

        const player = PlayerManager.getPlayer(guild.id);
        const connectedChannelId = player.connection?.joinConfig.channelId;
        if (connectedChannelId && connectedChannelId !== voiceChannel.id) {
            await interaction.followUp({ content: 'The bot is active in another voice channel.', ephemeral: true });
            return;
        }

        const tracks = PersonalPlaylists.getTracks(playlistId, interaction.user.id)
            .map((track: any) => ({
                ...track,
                requesterId: interaction.user.id,
                addedAt: Date.now(),
            }));
        if (shuffle) {
            for (let index = tracks.length - 1; index > 0; index -= 1) {
                const swap = Math.floor(Math.random() * (index + 1));
                [tracks[index], tracks[swap]] = [tracks[swap], tracks[index]];
            }
        }

        const added = player.queue.enqueueMany(tracks);
        if (!player.connection && added > 0) {
            player.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator as any,
            });
            player.connection.subscribe(player.audioPlayer);
        }
        if (!player.currentTrack && added > 0) player.playNext();
        await interaction.followUp({ content: `Queued ${added} playlist track(s).`, ephemeral: true });
    }

    private static async queueFavorite(
        interaction: ButtonInteraction | StringSelectMenuInteraction,
        favorite: any
    ) {
        const guild = client.guilds.cache.get(config.guildId);
        const member = await guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;
        if (!guild || !voiceChannel) {
            await interaction.followUp({ content: 'Join a voice channel in the server first.', ephemeral: true });
            return;
        }
        const player = PlayerManager.getPlayer(guild.id);
        if (player.connection?.joinConfig.channelId && player.connection.joinConfig.channelId !== voiceChannel.id) {
            await interaction.followUp({ content: 'The bot is active in another voice channel.', ephemeral: true });
            return;
        }
        if (!player.queue.enqueue({
            ...favorite,
            requesterId: interaction.user.id,
            addedAt: Date.now(),
        })) {
            await interaction.followUp({ content: 'The queue is full.', ephemeral: true });
            return;
        }
        if (!player.connection) {
            player.connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator as any,
            });
            player.connection.subscribe(player.audioPlayer);
        }
        if (!player.currentTrack) player.playNext();
        await interaction.followUp({ content: `Queued ${favorite.title}.`, ephemeral: true });
    }

    private static async renderView(user: User, message: Message, state: any) {
        let viewData;
        switch (state.currentView) {
            case 'playlists':
                viewData = await PlaylistsView.render(user.id);
                break;
            case 'playlist_detail':
                viewData = await PlaylistDetailView.render(user.id, state.currentPlaylistId, state.currentPage);
                break;
            case 'history':
                viewData = await HistoryView.render(user.id, undefined, state.currentPage);
                break;
            case 'track_detail':
                viewData = await TrackDetailView.render(user.id, state.currentTrackId);
                break;
            default:
                viewData = await MainView.render(user.id, state.currentPage);
        }
        await message.edit(viewData);
    }
}
