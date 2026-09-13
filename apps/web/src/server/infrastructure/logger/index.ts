/**
 * Structured logging utility
 *
 * Provides consistent, typed logging across the application.
 * Automatically disabled in production builds.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

export interface ServerLogger extends Logger {
  withContext: (context: { requestId?: string; userId?: string; path?: string }) => Logger;
}

interface LoggerOptions {
  /** Component or module name for namespacing logs */
  namespace: string;
  /** Minimum log level to output */
  minLevel?: LogLevel | undefined;
  /** Whether running in development mode */
  isDevelopment?: boolean | undefined;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  data?: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a structured logger instance
 */
export function createLogger(options: LoggerOptions): Logger {
  const { namespace, minLevel, isDevelopment } = options;

  // Default isDevelopment to false if not provided (safe default for tests)
  const isDev = isDevelopment ?? false;
  const effectiveMinLevel = minLevel ?? (isDev ? 'debug' : 'warn');

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[effectiveMinLevel];
  };

  const formatEntry = (level: LogLevel, message: string, data?: unknown): LogEntry => ({
    timestamp: new Date().toISOString(),
    level,
    namespace,
    message,
    data,
  });

  const log = (level: LogLevel, message: string, data?: unknown): void => {
    if (!shouldLog(level)) return;

    const entry = formatEntry(level, message, data);
    if (level === 'debug') {
      console.log(entry);
    } else if (level === 'info') {
      // biome-ignore lint/suspicious/noConsole: logger routes info to console.info
      console.info(entry);
    } else if (level === 'warn') {
      // biome-ignore lint/suspicious/noConsole: logger routes warn to console.warn
      console.warn(entry);
    } else {
      // biome-ignore lint/suspicious/noConsole: logger routes error to console.error
      console.error(entry);
    }
  };

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
}

/**
 * Server-side logger for API routes and server functions
 * Includes additional context for server environments
 */
export function createServerLogger(namespace: string, isDevelopment?: boolean): ServerLogger {
  const logger = createLogger({ namespace, minLevel: 'info', isDevelopment });

  return {
    ...logger,
    /**
     * Log with request context
     */
    withContext: (context: { requestId?: string; userId?: string; path?: string }) => ({
      debug: (message: string, data?: unknown) => logger.debug(message, { ...context, data }),
      info: (message: string, data?: unknown) => logger.info(message, { ...context, data }),
      warn: (message: string, data?: unknown) => logger.warn(message, { ...context, data }),
      error: (message: string, data?: unknown) => logger.error(message, { ...context, data }),
    }),
  };
}

/**
 * Get a logger instance with optional isDevelopment flag
 * @example
 * import { getLogger } from '@/server/infrastructure/logger'
 * const logger = getLogger(isDevelopment)
 * logger.debug('Something happened', { detail: 'value' })
 */
export function getLogger(isDevelopment?: boolean): Logger {
  return createLogger({ namespace: 'app', isDevelopment });
}

/**
 * Default logger for quick usage
 * @deprecated Use getLogger(isDevelopment) instead
 * @example
 * import { logger } from '@/server/infrastructure/logger'
 * logger.debug('Something happened', { detail: 'value' })
 */
export const logger = createLogger({ namespace: 'app', isDevelopment: false });
