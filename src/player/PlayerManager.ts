import { Collection } from 'discord.js';
import { MusicPlayer } from './MusicPlayer';

class PlayerManager {
    private static instance: PlayerManager;
    private players: Collection<string, MusicPlayer>;

    private constructor() {
        this.players = new Collection();
    }

    public static getInstance(): PlayerManager {
        if (!PlayerManager.instance) {
            PlayerManager.instance = new PlayerManager();
        }
        return PlayerManager.instance;
    }

    public getPlayer(guildId: string): MusicPlayer {
        if (!this.players.has(guildId)) {
            this.players.set(guildId, new MusicPlayer());
        }
        return this.players.get(guildId)!;
    }

    public deletePlayer(guildId: string) {
        this.players.delete(guildId);
    }
}

export default PlayerManager.getInstance();
