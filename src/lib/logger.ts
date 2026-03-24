import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['*.password', '*.token', '*.secret', '*.apiKey', '*.authorization', '*.cookie'],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Create child loggers for different modules
export const ocrLogger = logger.child({ module: 'ocr' });
export const helpCheckLogger = logger.child({ module: 'help-check' });
export const solutionLogger = logger.child({ module: 'solution-generation' });
export const voiceLogger = logger.child({ module: 'voice' });

export const chatLogger = logger.child({ module: 'chat' });
export const mathLogger = logger.child({ module: 'math' });
export const adminLogger = logger.child({ module: 'admin' });
export const classroomLogger = logger.child({ module: 'classroom' });
export const journalLogger = logger.child({ module: 'journal' });
export const creditsLogger = logger.child({ module: 'credits' });
export const goDeeperLogger = logger.child({ module: 'go-deeper' });
export const helpLogger = logger.child({ module: 'help' });
