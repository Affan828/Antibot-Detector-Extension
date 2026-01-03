/**
 * Scrappey Bot Detector - Debug Utilities
 * Development and debugging helpers
 */

const Debug = {
  // Debug mode flag
  enabled: false,
  
  /**
   * Enable debug mode
   */
  enable() {
    this.enabled = true;
    if (typeof TraceLogger !== 'undefined') {
      TraceLogger.currentLevel = TraceLogger.LEVELS.DEBUG;
    }
    console.log('[Scrappey] Debug mode enabled');
  },
  
  /**
   * Disable debug mode
   */
  disable() {
    this.enabled = false;
    if (typeof TraceLogger !== 'undefined') {
      TraceLogger.currentLevel = TraceLogger.LEVELS.INFO;
    }
  },
  
  /**
   * Log only in debug mode
   */
  log(...args) {
    if (this.enabled) {
      console.log('[Scrappey Debug]', ...args);
    }
  },
  
  /**
   * Time a function execution
   */
  time(label) {
    if (this.enabled) {
      console.time(`[Scrappey] ${label}`);
    }
  },
  
  /**
   * End timing
   */
  timeEnd(label) {
    if (this.enabled) {
      console.timeEnd(`[Scrappey] ${label}`);
    }
  },
  
  /**
   * Assert a condition
   */
  assert(condition, message) {
    if (this.enabled && !condition) {
      console.error('[Scrappey Assert Failed]', message);
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Debug = Debug;
}

