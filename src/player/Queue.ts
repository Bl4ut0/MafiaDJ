import { QueueItem } from '../types';

export class Queue {
    private items: QueueItem[] = [];

    public enqueue(item: QueueItem): void {
        this.items.push(item);
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
}
