export function formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');

    if (h > 0) {
        return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`; // or just m:s if h is 0, commonly m:ss
    // Wait, ${m} without padding if it's the leading unit? usually yes, but for consistency 0:00 is better
    // standard is MM:SS or H:MM:SS
    // if m < 10, it should be 0:05 not 5
    // actually standard for music is often 4:05.
    // I'll stick to ${m}:${sStr} for < hour.
}

export function createProgressBar(current: number, total: number, size: number = 20): string {
    const progress = Math.round((size * current) / total);
    const emptyProgress = size - progress;

    const progressText = '▇'.repeat(progress);
    const emptyProgressText = '—'.repeat(emptyProgress);

    return `[${progressText}${emptyProgressText}]`;
}
