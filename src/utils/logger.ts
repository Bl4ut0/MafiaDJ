import pino from 'pino';
import { config } from '../config';

export const logger = pino({
    level: config.bot?.logLevel || process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});
