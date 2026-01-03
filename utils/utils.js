/**
 * Scrappey Bot Detector - Utility Functions
 */

const Utils = {
  /**
   * Check if extension context is still valid
   */
  isExtensionContextValid() {
    try {
      return !!(chrome?.runtime?.id);
    } catch {
      return false;
    }
  },
  
  /**
   * Check if URL is valid for content scripts
   */
  isValidContentScriptUrl(url) {
    if (!url) return false;
    
    // Skip chrome:// pages, extension pages, etc.
    const invalidPrefixes = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'about:',
      'file://'
    ];
    
    return !invalidPrefixes.some(prefix => url.startsWith(prefix));
  },
  
  /**
   * Extract hostname from URL
   */
  getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },
  
  /**
   * Debounce function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * Throttle function calls
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  /**
   * Deep clone an object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  },
  
  /**
   * Format date for display
   */
  formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleString();
  },
  
  /**
   * Format relative time
   */
  formatRelativeTime(date) {
    if (!date) return '';
    
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  },
  
  /**
   * Notify page load to background
   */
  async notifyPageLoad(context) {
    if (!this.isExtensionContextValid()) {
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({
        type: 'PAGE_LOAD_NOTIFICATION',
        url: window.location.href
      });
    } catch (error) {
      TraceLogger.warn('UTILS', 'Failed to notify page load:', error.message);
    }
  },
  
  /**
   * Collect and send page data
   */
  async collectAndSendData(context) {
    if (!this.isExtensionContextValid()) {
      return;
    }
    
    try {
      const pageData = await ScanEngine.collectPageData(document, window);
      
      await chrome.runtime.sendMessage({
        type: 'PAGE_DATA',
        data: pageData
      });
      
      TraceLogger.content('Page data sent to background');
    } catch (error) {
      TraceLogger.error('UTILS', 'Failed to collect/send data:', error);
    }
  },
  
  /**
   * Perform context validity check
   */
  performContextCheck(state, cleanupFn) {
    if (!this.isExtensionContextValid()) {
      state.contextCheckFailures++;
      
      if (state.contextCheckFailures >= 3) {
        cleanupFn();
      }
    } else {
      state.contextCheckFailures = 0;
    }
  },
  
  /**
   * Clean up orphaned script
   */
  cleanupOrphanedScript(state) {
    if (state.hasCleanedUp) return;
    
    state.hasCleanedUp = true;
    TraceLogger.content('Cleaning up orphaned content script');
    
    // Clear any intervals/timeouts
    if (state.contextCheckInterval) {
      clearInterval(state.contextCheckInterval);
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Utils = Utils;
}

