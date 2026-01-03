/**
 * Scrappey Bot Detector - Scan Engine
 * Core detection logic for analyzing pages
 */

const ScanEngine = {
  // Loaded detectors reference
  detectors: null,
  
  // Pattern cache for performance
  patternCache: new Map(),
  
  /**
   * Set detectors reference
   */
  setDetectors(detectors) {
    this.detectors = detectors;
  },
  
  /**
   * Run detection on collected page data
   */
  async detectOnPage(pageData, detectors) {
    const results = [];
    
    if (!detectors || !pageData) {
      return results;
    }
    
    // Iterate through all categories and detectors
    for (const [category, categoryDetectors] of Object.entries(detectors)) {
      for (const [id, detector] of Object.entries(categoryDetectors)) {
        if (detector.enabled === false) continue;
        
        const matches = this.checkDetector(detector, pageData);
        
        if (matches.length > 0) {
          const confidence = ScoreCalculator.calculateConfidence(matches, detector.confidence);
          
          results.push({
            id: detector.id,
            name: detector.name,
            category: detector.category || category,
            confidence: confidence,
            icon: detector.icon,
            website: detector.website,
            description: detector.description,
            matches: matches
          });
        }
      }
    }
    
    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results;
  },
  
  /**
   * Check a single detector against page data
   */
  checkDetector(detector, pageData) {
    const matches = [];
    const detection = detector.detection || {};
    
    // Check cookies
    if (detection.cookie && pageData.cookies) {
      for (const rule of detection.cookie) {
        if (this.checkCookieRule(rule, pageData.cookies)) {
          matches.push({
            type: 'cookie',
            rule: rule.name,
            confidence: rule.confidence || 50,
            description: rule.description
          });
        }
      }
    }
    
    // Check URLs (scripts, resources)
    if (detection.url && pageData.scripts) {
      for (const rule of detection.url) {
        for (const script of pageData.scripts) {
          if (this.checkTextRule(rule, script)) {
            matches.push({
              type: 'url',
              rule: rule.text,
              confidence: rule.confidence || 50,
              description: rule.description
            });
            break; // One match per rule is enough
          }
        }
      }
    }
    
    // Check page content
    if (detection.content && pageData.html) {
      for (const rule of detection.content) {
        if (this.checkTextRule(rule, pageData.html)) {
          matches.push({
            type: 'content',
            rule: rule.text,
            confidence: rule.confidence || 50,
            description: rule.description
          });
        }
      }
    }
    
    // Check DOM elements
    if (detection.dom && pageData.dom) {
      for (const rule of detection.dom) {
        if (this.checkDomRule(rule, pageData.dom)) {
          matches.push({
            type: 'dom',
            rule: rule.selector,
            confidence: rule.confidence || 50,
            description: rule.description
          });
        }
      }
    }
    
    // Check window properties
    if (detection.window && pageData.windowProps) {
      for (const rule of detection.window) {
        if (this.checkWindowRule(rule, pageData.windowProps)) {
          matches.push({
            type: 'window',
            rule: rule.path,
            confidence: rule.confidence || 50,
            description: rule.description
          });
        }
      }
    }
    
    // Check JS hooks
    if (detection.js_hooks && pageData.jsHooks) {
      for (const rule of detection.js_hooks) {
        if (rule.enabled !== false && pageData.jsHooks.includes(rule.target)) {
          matches.push({
            type: 'js_hook',
            rule: rule.target,
            confidence: rule.confidence || 50,
            description: rule.description
          });
        }
      }
    }
    
    return matches;
  },
  
  /**
   * Check a cookie rule
   */
  checkCookieRule(rule, cookies) {
    for (const cookie of cookies) {
      const nameMatch = this.matchText(
        rule.name,
        cookie.name,
        rule.nameRegex,
        rule.nameCaseSensitive,
        rule.nameWholeWord
      );
      
      if (nameMatch) {
        // If value is specified, check it too
        if (rule.value) {
          return this.matchText(
            rule.value,
            cookie.value,
            rule.valueRegex,
            rule.valueCaseSensitive,
            rule.valueWholeWord
          );
        }
        return true;
      }
    }
    return false;
  },
  
  /**
   * Check a text-based rule (url, content)
   */
  checkTextRule(rule, text) {
    if (!text || !rule.text) return false;
    
    return this.matchText(
      rule.text,
      text,
      rule.textRegex,
      rule.textCaseSensitive,
      rule.textWholeWord
    );
  },
  
  /**
   * Check a DOM rule
   */
  checkDomRule(rule, domData) {
    // domData contains arrays of found selectors
    if (!domData || !rule.selector) return false;
    
    // Check if selector was found in page
    return domData.selectors?.includes(rule.selector) || false;
  },
  
  /**
   * Check a window property rule
   */
  checkWindowRule(rule, windowProps) {
    if (!windowProps || !rule.path) return false;
    
    // Check if the property path was found
    return windowProps.includes(rule.path);
  },
  
  /**
   * Match text with various options
   */
  matchText(pattern, text, isRegex, caseSensitive, wholeWord) {
    if (!pattern || !text) return false;
    
    try {
      if (isRegex) {
        const cacheKey = `${pattern}_${caseSensitive}`;
        let regex = this.patternCache.get(cacheKey);
        
        if (!regex) {
          regex = new RegExp(pattern, caseSensitive ? '' : 'i');
          this.patternCache.set(cacheKey, regex);
        }
        
        return regex.test(text);
      }
      
      let searchText = text;
      let searchPattern = pattern;
      
      if (!caseSensitive) {
        searchText = text.toLowerCase();
        searchPattern = pattern.toLowerCase();
      }
      
      if (wholeWord) {
        const wordRegex = new RegExp(`\\b${this.escapeRegex(searchPattern)}\\b`, caseSensitive ? '' : 'i');
        return wordRegex.test(text);
      }
      
      return searchText.includes(searchPattern);
      
    } catch (error) {
      TraceLogger.warn('DETECTION', 'Pattern match error:', error);
      return false;
    }
  },
  
  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  /**
   * Collect page data for detection
   */
  async collectPageData(document, window) {
    const data = {
      url: window.location.href,
      html: '',
      scripts: [],
      cookies: [],
      dom: { selectors: [] },
      windowProps: [],
      jsHooks: []
    };
    
    try {
      // Collect HTML content (limited for performance)
      data.html = document.documentElement?.outerHTML?.slice(0, 100000) || '';
      
      // Collect script sources
      const scripts = document.querySelectorAll('script[src]');
      data.scripts = Array.from(scripts).map(s => s.src).filter(Boolean);
      
      // Also check inline scripts
      const inlineScripts = document.querySelectorAll('script:not([src])');
      for (const script of inlineScripts) {
        if (script.textContent) {
          data.html += script.textContent;
        }
      }
      
      // Collect common detection selectors
      const selectorsToCheck = [
        '.g-recaptcha',
        '[data-sitekey]',
        '.h-captcha',
        '.cf-turnstile',
        '#challenge-form',
        '.captcha-container',
        '[data-callback]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'iframe[src*="challenge"]'
      ];
      
      for (const selector of selectorsToCheck) {
        try {
          if (document.querySelector(selector)) {
            data.dom.selectors.push(selector);
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
    } catch (error) {
      TraceLogger.error('DETECTION', 'Error collecting page data:', error);
    }
    
    return data;
  },
  
  /**
   * Install JS hooks for fingerprint detection
   */
  installHooksOrchestrator(window, chrome) {
    // This is handled by content-main-world.js
    TraceLogger.debug('DETECTION', 'Hooks orchestrator called');
  },
  
  /**
   * Create hook batcher for batching hook detections
   */
  createHookBatcher(chrome) {
    const batcher = {
      queue: [],
      timeout: null,
      
      add(detection) {
        this.queue.push(detection);
        
        if (!this.timeout) {
          this.timeout = setTimeout(() => {
            this.flush();
          }, 50);
        }
      },
      
      flush() {
        if (this.queue.length > 0) {
          chrome.runtime.sendMessage({
            type: 'JS_HOOK_BATCH',
            hooks: [...this.queue]
          }).catch(() => {});
          
          this.queue = [];
        }
        this.timeout = null;
      }
    };
    
    return batcher;
  },
  
  /**
   * Handle hook message from MAIN world
   */
  handleHookMessage(event, chrome, batcher) {
    if (event.data?.type === 'JS_HOOK_DETECTION') {
      batcher.add({
        target: event.data.target,
        detectorId: event.data.detectorId,
        timestamp: Date.now()
      });
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ScanEngine = ScanEngine;
}

