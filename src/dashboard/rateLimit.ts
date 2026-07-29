import { NextFunction, Request, Response } from 'express';

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(name: string, limit: number, windowMs: number) {
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const identity = req.session?.userId || req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${name}:${identity}`;
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;
        res.setHeader('RateLimit-Limit', String(limit));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > limit) {
            return res.status(429).json({ error: 'Too many requests. Please slow down.' });
        }

        if (buckets.size > 10_000) {
            for (const [bucketKey, value] of buckets) {
                if (value.resetAt <= now) buckets.delete(bucketKey);
            }
        }
        next();
    };
}
