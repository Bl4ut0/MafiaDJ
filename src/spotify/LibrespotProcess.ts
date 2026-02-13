import { spawn, ChildProcess } from 'child_process';
import { config } from '../config';

class LibrespotProcess {
    private static instance: LibrespotProcess;
    private process: ChildProcess | null = null;
    private isRunning: boolean = false;

    private constructor() {
        this.start();
    }

    public static getInstance(): LibrespotProcess {
        if (!LibrespotProcess.instance) {
            LibrespotProcess.instance = new LibrespotProcess();
        }
        return LibrespotProcess.instance;
    }

    public start() {
        if (this.isRunning) return;

        console.log('[Librespot] Starting process...');

        // Ensure credentials
        if (!config.spotifyUsername || !config.spotifyPassword) {
            console.warn('[Librespot] Missing Spotify credentials in .env. Librespot disabled.');
            return;
        }

        this.process = spawn((config as any).paths?.librespot || 'librespot', [
            '--name', 'MafiaDJ',
            '--backend', 'pipe',
            '--format', 'S16', // Signed 16-bit PCM
            '--username', config.spotifyUsername, // Note: Be careful with special chars in shell args, spawn handles safely? Yes.
            '--password', config.spotifyPassword,
            '--bitrate', '320',
            '--disable-audio-cache',
            '--device-type', 'speaker'
        ]);

        this.isRunning = true;

        this.process.stderr?.on('data', (data) => {
            console.log(`[Librespot Log]: ${data.toString().trim()}`);
        });

        this.process.on('close', (code) => {
            console.warn(`[Librespot] Process exited with code ${code}. Restarting in 5s...`);
            this.isRunning = false;
            setTimeout(() => this.start(), 5000);
        });

        // We'll need a way to access the stdout stream from MusicPlayer when we switch to direct piping?
        // Actually, librespot --backend pipe writes to STDOUT.
        // But librespot runs continuously as a daemon. 
        // When we play a song, it writes audio to stdout.
        // We need to pipe THAT stdout into our ffmpeg/discord stream.
        // However, if we just let it run, where does the stdout go? 
        // We capture it in this.process.stdout.

        // This complexity is why the Fallback is good for now.
        // Direct piping requires:
        // 1. Bot receives /play spotify:track:id
        // 2. Bot uses Spotify Web API to tell "MafiaDJ" device to play that track.
        // 3. Librespot immediately starts writing PCM to its stdout.
        // 4. We need to have `this.process.stdout` piped into an AudioResource constantly? 
        //    Or create a new resource when playback starts?
        //    Discord.js AudioPlayer expects a resource. 
        //    We can treat the librespot stdout as a continuous stream resource.
        //    If silence, it effectively pauses? 

        // This is advanced Phase 3 step. For now, the process manager just keeps it alive.
    }

    public getStdout() {
        return this.process?.stdout;
    }
}

export default LibrespotProcess;
