import pino from 'pino';

const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const rawLevel = (process.env.LOG_LEVEL || 'info').toLowerCase().trim();
const logLevel = validLevels.includes(rawLevel) ? rawLevel : 'info';

export const logger = pino({
    level: logLevel,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});
