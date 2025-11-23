import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Create child loggers for different modules
export const ocrLogger = logger.child({ module: 'ocr' });
export const helpCheckLogger = logger.child({ module: 'help-check' });
export const solutionLogger = logger.child({ module: 'solution-generation' });
