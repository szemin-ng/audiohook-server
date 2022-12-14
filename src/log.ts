import pino from "pino";

const pinoLogger = pino({
//  level: process.env.PINO_LOG_LEVEL || process.env.NODE_ENV == "production" ? "info" : "debug"
  level: process.env.PINO_LOG_LEVEL || process.env.NODE_ENV == "production" ? "info" : "info"
});

class Logger {

  debug(data: any, msg?: string | undefined,...args: any[]): void {
    pinoLogger.debug(data, msg, args);
  }

  error(data: any, msg?: string | undefined,...args: any[]): void {
    pinoLogger.error(data, msg, args);
  }

  info(data: any, msg?: string | undefined,...args: any[]): void {
    pinoLogger.info(data, msg, args);
  }

  trace(data: any, msg?: string | undefined,...args: any[]): void {
    pinoLogger.trace(data, msg, args);
  }

  warn(data: any, msg?: string | undefined,...args: any[]): void {
    pinoLogger.warn(data, msg, args);
  }  
}

const logger = new Logger();

export default logger;