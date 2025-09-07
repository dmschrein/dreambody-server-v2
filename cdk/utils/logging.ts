// cdk/functions/utils/logging.ts

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

const allowedLevels: LogLevel[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"];

export function resolveLogLevel(defaultLevel: LogLevel = "INFO"): LogLevel {
  const envLevel = (
    process.env.LOG_LEVEL ||
    process.env.logLevel ||
    ""
  ).toUpperCase();
  if (allowedLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  // Fallback by environment
  if ((process.env.NODE_ENV || "").toLowerCase() === "production") {
    return "WARN";
  }
  return defaultLevel;
}

/**
 * Adjusts a Powertools Logger (or compatible) instance's log level based on environment variables.
 * - LOG_LEVEL overrides everything when present (TRACE|DEBUG|INFO|WARN|ERROR)
 * - Defaults to DEBUG for non-production NODE_ENV; WARN for production
 */
export function setLoggingLevel(logger: {
  setLogLevel: (level: LogLevel) => void;
}): void {
  const level = resolveLogLevel(
    (process.env.NODE_ENV || "").toLowerCase() === "production"
      ? "WARN"
      : "DEBUG",
  );
  try {
    logger.setLogLevel(level);
  } catch {
    // No-op if the logger doesn't support dynamic level changes
  }
}
