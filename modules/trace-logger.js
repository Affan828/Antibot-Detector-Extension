/**
 * Scrappey Bot Detector - Trace Logger Module
 * Centralized logging with consistent formatting
 */

const TraceLogger = {
  // Log levels
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  
  // Current log level (can be changed via settings)
  currentLevel: 1, // INFO by default
  
  // Prefix for all logs
  PREFIX: '[Scrappey]',
  
  /**
   * Format a log message
   */
  format(category, message, data) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const prefix = `${this.PREFIX} [${timestamp}] [${category}]`;
    
    if (data) {
      return [prefix, message, data];
    }
    return [prefix, message];
  },
  
  /**
   * Debug level logging
   */
  debug(category, message, data) {
    if (this.currentLevel <= this.LEVELS.DEBUG) {
      console.debug(...this.format(category, message, data));
    }
  },
  
  /**
   * Info level logging
   */
  info(category, message, data) {
    if (this.currentLevel <= this.LEVELS.INFO) {
      console.info(...this.format(category, message, data));
    }
  },
  
  /**
   * Warning level logging
   */
  warn(category, message, data) {
    if (this.currentLevel <= this.LEVELS.WARN) {
      console.warn(...this.format(category, message, data));
    }
  },
  
  /**
   * Error level logging
   */
  error(category, message, data) {
    if (this.currentLevel <= this.LEVELS.ERROR) {
      console.error(...this.format(category, message, data));
    }
  },
  
  /**
   * Shorthand for content script logs
   */
  content(message, data) {
    this.info('CONTENT', message, data);
  },
  
  /**
   * Shorthand for background script logs
   */
  background(message, data) {
    this.info('BACKGROUND', message, data);
  },
  
  /**
   * Shorthand for detection logs
   */
  detection(message, data) {
    this.info('DETECTION', message, data);
  },
  
  /**
   * Shorthand for cache logs
   */
  cache(message, data) {
    this.debug('CACHE', message, data);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TraceLogger = TraceLogger;
}

