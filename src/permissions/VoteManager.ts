import { Collection, GuildMember, Message, User, VoiceBasedChannel } from 'discord.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import ServerSettings from '../database/ServerSettings';

interface Vote {
    action: 'skip' | 'stop' | 'pause' | 'resume';
    initiatorId: string;
    targetId?: string; // e.g. track ID if needed
    votes: Set<string>; // User IDs
    required: number;
    messageId?: string;
    voiceChannelId: string;
    expires at: number;
}

class VoteManager {
    private votes: Collection<string, Vote> = new Collection(); // guildId -> active vote

    public async requestVote(
        guildId: string,
        member: GuildMember,
        action: 'skip' | 'stop' | 'pause' | 'resume',
        voiceChannel: VoiceBasedChannel,
        executeCallback: () => void
    ) {
        // 1. Check if user is alone with bot (Instant action)
        // Filter bots out of count
        const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (humanMembers.size <= 1) {
            // User is alone with bot -> Instant execute
            executeCallback();
            return { type: 'instant' };
        }

        // 2. Check for existing vote
        if (this.votes.has(guildId)) {
            const currentVote = this.votes.get(guildId)!;
            if (currentVote.action !== action) {
                return { type: 'error', message: `A vote to **${currentVote.action}** is already in progress.` };
            }
            // Add vote
            return this.castVote(guildId, member, executeCallback);
        }

        // 3. Start new vote
        const settings = ServerSettings.getSettings(guildId);
        let thresholdPercent = 50;
        if (action === 'stop') thresholdPercent = settings.vote_stop_threshold;
        else thresholdPercent = settings.vote_skip_threshold;

        const required = Math.ceil(humanMembers.size * (thresholdPercent / 100));

        const vote: Vote = {
            action,
            initiatorId: member.id,
            votes: new Set([member.id]), // Initiator votes automatically
            required,
            voiceChannelId: voiceChannel.id,
            expires: Date.now() + 60000 // 60s expiry
        };

        this.votes.set(guildId, vote);

        // Check if initiator vote is enough (e.g. 2 people, 50% = 1 vote needed)
        if (vote.votes.size >= required) {
            this.votes.delete(guildId);
            executeCallback();
            return { type: 'instant' }; // Or 'success'
        }

        return { type: 'started', vote };
    }

    public castVote(guildId: string, member: GuildMember, executeCallback: () => void) {
        const vote = this.votes.get(guildId);
        if (!vote) return { type: 'error', message: 'No active vote.' };

        if (vote.votes.has(member.id)) {
            return { type: 'error', message: 'You have already voted.' };
        }

        vote.votes.add(member.id);

        if (vote.votes.size >= vote.required) {
            this.votes.delete(guildId);
            executeCallback();
            return { type: 'success' };
        }

        return { type: 'updated', vote };
    }

    // UI Builder for Vote Embed
    public createVoteEmbed(vote: Vote) {
        const percent = Math.round((vote.votes.size / vote.required) * 100);

        return new EmbedBuilder()
            .setColor('#F59E0B') // Amber
            .setTitle(`Vote to ${vote.action.toUpperCase()}?`)
            .setDescription(`Req: **${vote.required}** votes (${percent}%)\nCurrent: **${vote.votes.size}** votes`)
            .setFooter({ text: 'Vote ends in 60s' });
    }
}

export default new VoteManager();
