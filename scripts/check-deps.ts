import { spawnSync } from 'child_process';
import { config } from '../src/config';

console.log('Checking dependencies...');

const dependencies = [
    { name: 'Node.js', command: 'node', args: ['--version'] },
    { name: 'yt-dlp', command: (config as any).paths?.ytdlp || 'yt-dlp', args: ['--version'] },
    { name: 'FFmpeg', command: (config as any).paths?.ffmpeg || 'ffmpeg', args: ['-version'] },
    { name: 'Librespot', command: (config as any).paths?.librespot || 'librespot', args: ['--version'] } // Librespot check might fail if not built yet
];

let allPassed = true;

for (const dep of dependencies) {
    try {
        const result = spawnSync(dep.command, dep.args);
        if (result.error) {
            console.error(`❌ ${dep.name} not found or failed to run.`);
            allPassed = false;
        } else {
            console.log(`✅ ${dep.name} found.`);
        }
    } catch (error) {
        console.error(`❌ ${dep.name} check threw an error:`, error);
        allPassed = false;
    }
}

if (allPassed) {
    console.log('All dependencies checked successfully.');
    process.exit(0);
} else {
    console.error('Some dependencies are missing.');
    process.exit(1);
}
