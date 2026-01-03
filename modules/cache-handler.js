/**
 * Scrappey Bot Detector - Cache Handler
 * Handles all chrome.storage operations with caching
 */

const CacheHandler = {
  // In-memory cache for faster access
  cache: new Map(),
  
  // Cache expiry times (in ms)
  CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours default
  
  /**
   * Get a value from storage
   */
  async get(key, defaultValue = null) {
    try {
      // Check memory cache first
      if (this.cache.has(key)) {
        const cached = this.cache.get(key);
        if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
          return cached.value;
        }
        this.cache.delete(key);
      }
      
      // Fetch from chrome.storage
      const result = await chrome.storage.local.get([key]);
      const value = result[key] !== undefined ? result[key] : defaultValue;
      
      // Update memory cache
      this.cache.set(key, { value, timestamp: Date.now() });
      
      return value;
    } catch (error) {
      TraceLogger.error('STORAGE', `Error getting ${key}:`, error);
      return defaultValue;
    }
  },
  
  /**
   * Set a value in storage
   */
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      
      // Update memory cache
      this.cache.set(key, { value, timestamp: Date.now() });
      
      return true;
    } catch (error) {
      TraceLogger.error('STORAGE', `Error setting ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Remove a value from storage
   */
  async remove(key) {
    try {
      await chrome.storage.local.remove([key]);
      this.cache.delete(key);
      return true;
    } catch (error) {
      TraceLogger.error('STORAGE', `Error removing ${key}:`, error);
      return false;
    }
  },
  
  /**
   * Get detection cache for a URL
   */
  async getDetectionCache(url) {
    const cacheKey = `detection_${this.hashUrl(url)}`;
    const cached = await this.get(cacheKey);
    
    if (cached && cached.timestamp) {
      const duration = await this.get('scrappey_cache_duration', 12);
      const maxAge = duration * 60 * 60 * 1000;
      
      if (Date.now() - cached.timestamp < maxAge) {
        return cached;
      }
    }
    
    return null;
  },
  
  /**
   * Set detection cache for a URL
   */
  async setDetectionCache(url, detections) {
    const cacheKey = `detection_${this.hashUrl(url)}`;
    
    await this.set(cacheKey, {
      url: url,
      detections: detections,
      timestamp: Date.now(),
      count: detections.length
    });
  },
  
  /**
   * Clear all detection caches
   */
  async clearDetectionCache() {
    try {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter(key => key.startsWith('detection_'));
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        
        // Clear memory cache too
        keysToRemove.forEach(key => this.cache.delete(key));
      }
      
      TraceLogger.cache(`Cleared ${keysToRemove.length} detection cache entries`);
      return true;
    } catch (error) {
      TraceLogger.error('STORAGE', 'Error clearing cache:', error);
      return false;
    }
  },
  
  /**
   * Simple hash function for URLs
   */
  hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CacheHandler = CacheHandler;
}

