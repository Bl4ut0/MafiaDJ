import { QueueItem } from '../types';

export class Queue {
    private items: QueueItem[] = [];
    private readonly maxLength: number;

    constructor(maxLength: number = 200) {
        this.maxLength = maxLength;
    }

    public enqueue(item: QueueItem): boolean {
        if (this.items.length >= this.maxLength) return false;
        this.items.push(item);
        return true;
    }

    public enqueueMany(items: QueueItem[]): number {
        let added = 0;
        for (const item of items) {
            if (!this.enqueue(item)) break;
            added += 1;
        }
        return added;
    }

    public remainingCapacity(): number {
        return Math.max(0, this.maxLength - this.items.length);
    }

    public dequeue(): QueueItem | undefined {
        return this.items.shift();
    }

    public peek(): QueueItem | undefined {
        return this.items[0];
    }

    public isEmpty(): boolean {
        return this.items.length === 0;
    }

    public size(): number {
        return this.items.length;
    }

    public clear(): void {
        this.items = [];
    }

    public getTracks(): QueueItem[] {
        return [...this.items];
    }

    public shuffle(): void {
        for (let i = this.items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
        }
    }

    /** Move a track from one position to another */
    public move(from: number, to: number): boolean {
        if (from < 0 || from >= this.items.length || to < 0 || to >= this.items.length) {
            return false;
        }
        const [item] = this.items.splice(from, 1);
        this.items.splice(to, 0, item);
        return true;
    }

    /** Remove a track at the given index */
    public remove(index: number): QueueItem | null {
        if (index < 0 || index >= this.items.length) {
            return null;
        }
        const [removed] = this.items.splice(index, 1);
        return removed;
    }

    /** Insert a track at a specific position */
    public insertAt(index: number, item: QueueItem): boolean {
        if (this.items.length >= this.maxLength) return false;
        const clamped = Math.max(0, Math.min(index, this.items.length));
        this.items.splice(clamped, 0, item);
        return true;
    }
}
