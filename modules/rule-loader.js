/**
 * Scrappey Bot Detector - Rule Loader
 * Loads and manages detector definitions from JSON files
 */

const RuleLoader = {
  // Loaded detectors cache
  detectors: null,
  categories: null,
  
  /**
   * Transform new JSON format to detection engine format
   */
  transformDetector(rawDetector) {
    if (!rawDetector || !rawDetector.detector) {
      return null;
    }
    
    const det = rawDetector.detector;
    const meta = rawDetector.meta || {};
    const patterns = rawDetector.patterns || {};
    
    // Transform to old format for compatibility
    return {
      id: det.id,
      name: det.label || det.id,
      enabled: det.active !== false,
      category: det.type === 'antibot' ? 'Anti-Bot' : det.type === 'captcha' ? 'CAPTCHA' : 'Fingerprint',
      color: meta.color || '#14B8A6',
      icon: meta.icon || 'vendor-default.png',
      website: meta.vendorUrl || meta.infoUrl || '',
      description: rawDetector.info || '',
      confidence: 80, // Default confidence
      lastUpdated: meta.updatedAt || '2025-01-03',
      version: '1.0.0',
      // Transform patterns to detection format
      detection: {
        cookie: (patterns.cookies || []).map(p => ({
          name: p.match,
          confidence: p.score || 80,
          description: p.note || '',
          nameRegex: false,
          nameCaseSensitive: false,
          nameWholeWord: false,
          value: '',
          valueRegex: false,
          valueCaseSensitive: false,
          valueWholeWord: false,
          nameScope: 'all',
          valueScope: 'all'
        })),
        url: (patterns.urls || []).map(p => ({
          text: p.match,
          confidence: p.score || 80,
          description: p.note || '',
          textRegex: false,
          textCaseSensitive: false,
          textWholeWord: false,
          textScope: 'all'
        })),
        content: (patterns.content || []).map(p => ({
          text: p.match,
          confidence: p.score || 80,
          description: p.note || '',
          textRegex: false,
          textCaseSensitive: false,
          textWholeWord: false
        })),
        dom: (patterns.dom || []).map(p => ({
          selector: p.match,
          confidence: p.score || 80,
          description: p.note || '',
          selectorRegex: false,
          selectorCaseSensitive: false,
          selectorWholeWord: false
        })),
        window: (patterns.globals || []).map(p => ({
          path: p.match,
          condition: 'typeof object',
          confidence: p.score || 80,
          description: p.note || ''
        })),
        js_hooks: (patterns.jsHooks || []).map(p => ({
          target: p.target,
          enabled: true,
          confidence: p.score || 80,
          description: p.note || ''
        })),
        header: (patterns.headers || []).map(p => ({
          name: p.match,
          confidence: p.score || 80,
          description: p.note || '',
          nameRegex: false,
          nameCaseSensitive: false,
          nameWholeWord: false,
          value: '',
          valueRegex: false,
          valueCaseSensitive: false,
          valueWholeWord: false,
          nameScope: 'all',
          valueScope: 'all'
        }))
      }
    };
  },
  
  /**
   * Load all detectors from JSON files
   */
  async loadDetectors() {
    if (this.detectors) {
      return this.detectors;
    }
    
    try {
      // Load index file first
      const indexResponse = await fetch(chrome.runtime.getURL('detectors/index.json'));
      const index = await indexResponse.json();
      
      this.categories = index;
      this.detectors = {
        antibot: {},
        captcha: {},
        fingerprint: {}
      };
      
      // Load all detectors in parallel
      const loadPromises = [];
      
      // Handle new format with categories.categories
      const categories = index.categories || index;
      
      for (const [categoryKey, config] of Object.entries(categories)) {
        if (categoryKey === 'tags' || categoryKey === 'badge' || categoryKey === 'theme' || categoryKey === 'matchTypes') continue;
        
        const categoryName = categoryKey; // antibot, captcha, fingerprint
        const detectorList = config.detectors || config;
        
        if (Array.isArray(detectorList)) {
          for (const detectorName of detectorList) {
            loadPromises.push(
              this.loadDetector(categoryName, detectorName)
            );
          }
        }
      }
      
      await Promise.all(loadPromises);
      
      TraceLogger.detection(`Loaded ${this.getDetectorCount()} detectors`);
      
      return this.detectors;
      
    } catch (error) {
      TraceLogger.error('DETECTOR', 'Error loading detectors:', error);
      return this.detectors || {};
    }
  },
  
  /**
   * Load a single detector
   */
  async loadDetector(category, name) {
    try {
      const url = chrome.runtime.getURL(`detectors/${category}/detect-${name}.json`);
      const response = await fetch(url);
      const rawDetector = await response.json();
      
      // Transform to compatible format
      const detector = this.transformDetector(rawDetector);
      
      if (detector && detector.id) {
        if (!this.detectors[category]) {
          this.detectors[category] = {};
        }
        this.detectors[category][detector.id] = detector;
      }
    } catch (error) {
      TraceLogger.warn('DETECTOR', `Failed to load ${category}/${name}:`, error.message);
    }
  },
  
  /**
   * Get all detectors
   */
  getDetectors() {
    return this.detectors || {};
  },
  
  /**
   * Get detectors by category
   */
  getDetectorsByCategory(category) {
    return this.detectors?.[category] || {};
  },
  
  /**
   * Get a specific detector by ID
   */
  getDetector(id) {
    for (const category of Object.values(this.detectors || {})) {
      if (category[id]) {
        return category[id];
      }
    }
    return null;
  },
  
  /**
   * Get total detector count
   */
  getDetectorCount() {
    let count = 0;
    for (const category of Object.values(this.detectors || {})) {
      count += Object.keys(category).length;
    }
    return count;
  },
  
  /**
   * Get enabled detectors only
   */
  getEnabledDetectors() {
    const enabled = {};
    
    for (const [category, detectors] of Object.entries(this.detectors || {})) {
      enabled[category] = {};
      for (const [id, detector] of Object.entries(detectors)) {
        if (detector && detector.enabled !== false) {
          enabled[category][id] = detector;
        }
      }
    }
    
    return enabled;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.RuleLoader = RuleLoader;
}

