/**
 * Scrappey Bot Detector - Background Service Worker
 * Handles detection coordination, caching, and badge updates
 */

// Initialize detectors on startup
let detectorsLoaded = false;
let detectors = {};

// Detection cache
const detectionCache = new Map();
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Initialize the extension
 */
async function initialize() {
  console.log('[Scrappey] Background service worker starting...');
  
  // Load detectors
  await loadDetectors();
  
  console.log('[Scrappey] Background service worker ready');
}

/**
 * Transform new JSON format to detection engine format
 */
function transformDetector(rawDetector) {
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
    icon: meta.icon || 'custom.png',
    website: meta.vendorUrl || meta.infoUrl || '',
    description: rawDetector.info || '',
    confidence: 80,
    lastUpdated: meta.updatedAt || '2025-01-03',
    version: '1.0.0',
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
}

/**
 * Load all detector definitions
 */
async function loadDetectors() {
  try {
    // Load index
    const indexResponse = await fetch(chrome.runtime.getURL('detectors/index.json'));
    const index = await indexResponse.json();
    
    detectors = {
      antibot: {},
      captcha: {},
      fingerprint: {}
    };
    
    const loadPromises = [];
    
    // Handle new format with categories.categories
    const categories = index.categories || index;
    
    for (const [categoryKey, config] of Object.entries(categories)) {
      if (categoryKey === 'tags' || categoryKey === 'badge' || categoryKey === 'theme' || categoryKey === 'matchTypes') continue;
      
      const categoryName = categoryKey;
      const detectorList = config.detectors || config;
      
      if (Array.isArray(detectorList)) {
        for (const name of detectorList) {
          loadPromises.push(loadDetector(categoryName, name));
        }
      }
    }
    
    await Promise.all(loadPromises);
    
    detectorsLoaded = true;
    
    const count = Object.values(detectors).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
    console.log(`[Scrappey] Loaded ${count} detectors`);
    
  } catch (error) {
    console.error('[Scrappey] Error loading detectors:', error);
  }
}

/**
 * Load a single detector
 */
async function loadDetector(category, name) {
  try {
    const url = chrome.runtime.getURL(`detectors/${category}/detect-${name}.json`);
    const response = await fetch(url);
    const rawDetector = await response.json();
    
    // Transform to compatible format
    const detector = transformDetector(rawDetector);
    
    if (detector && detector.id) {
      if (!detectors[category]) {
        detectors[category] = {};
      }
      detectors[category][detector.id] = detector;
    }
  } catch (error) {
    // Silently skip failed detectors
  }
}

/**
 * Run detection on page data
 */
async function runDetection(pageData) {
  const results = [];
  
  if (!detectorsLoaded || !pageData) {
    return results;
  }
  
  // Check settings for fingerprinting
  const settings = await chrome.storage.local.get(['scrappey_show_fingerprinting']);
  const showFingerprinting = settings.scrappey_show_fingerprinting !== false;
  
  for (const [category, categoryDetectors] of Object.entries(detectors)) {
    // Skip fingerprinting if disabled
    if (category === 'fingerprint' && !showFingerprinting) {
      continue;
    }
    
    for (const [id, detector] of Object.entries(categoryDetectors)) {
      if (detector.enabled === false) continue;
      
      const matches = checkDetector(detector, pageData);
      
      if (matches.length > 0) {
        const confidence = calculateConfidence(matches, detector.confidence);
        
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
  
  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);
  
  return results;
}

/**
 * Check a detector against page data
 */
function checkDetector(detector, pageData) {
  const matches = [];
  const detection = detector.detection || {};
  
  // Check cookies
  if (detection.cookie && pageData.cookies) {
    for (const rule of detection.cookie) {
      if (checkCookieRule(rule, pageData.cookies)) {
        matches.push({
          type: 'cookie',
          rule: rule.name,
          confidence: rule.confidence || 50,
          description: rule.description
        });
      }
    }
  }
  
  // Check URLs
  if (detection.url && pageData.scripts) {
    for (const rule of detection.url) {
      for (const script of pageData.scripts) {
        if (matchText(rule.text, script, rule.textRegex, rule.textCaseSensitive)) {
          matches.push({
            type: 'url',
            rule: rule.text,
            confidence: rule.confidence || 50,
            description: rule.description
          });
          break;
        }
      }
    }
  }
  
  // Check content
  if (detection.content && pageData.html) {
    for (const rule of detection.content) {
      if (matchText(rule.text, pageData.html, rule.textRegex, rule.textCaseSensitive)) {
        matches.push({
          type: 'content',
          rule: rule.text,
          confidence: rule.confidence || 50,
          description: rule.description
        });
      }
    }
  }
  
  // Check DOM
  if (detection.dom && pageData.dom?.selectors) {
    for (const rule of detection.dom) {
      if (pageData.dom.selectors.includes(rule.selector)) {
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
      if (pageData.windowProps.includes(rule.path)) {
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
}

/**
 * Check cookie rule
 */
function checkCookieRule(rule, cookies) {
  for (const cookie of cookies) {
    if (matchText(rule.name, cookie.name, rule.nameRegex, rule.nameCaseSensitive)) {
      if (!rule.value) return true;
      return matchText(rule.value, cookie.value, rule.valueRegex, rule.valueCaseSensitive);
    }
  }
  return false;
}

/**
 * Match text with options
 */
function matchText(pattern, text, isRegex, caseSensitive) {
  if (!pattern || !text) return false;
  
  try {
    if (isRegex) {
      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
      return regex.test(text);
    }
    
    if (caseSensitive) {
      return text.includes(pattern);
    }
    
    return text.toLowerCase().includes(pattern.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Calculate confidence score
 */
function calculateConfidence(matches, baseConfidence = 50) {
  let maxConfidence = baseConfidence;
  
  for (const match of matches) {
    if (match.confidence > maxConfidence) {
      maxConfidence = match.confidence;
    }
  }
  
  // Boost for multiple matches
  const boost = Math.min(matches.length * 2, 15);
  
  return Math.min(maxConfidence + boost, 100);
}

/**
 * Update extension badge
 */
async function updateBadge(tabId, detectionCount) {
  try {
    const text = detectionCount > 0 ? (detectionCount > 99 ? '99+' : String(detectionCount)) : '';
    const color = detectionCount === 0 ? '#4CAF50' : detectionCount <= 2 ? '#FFA500' : '#FF4444';
    
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
  } catch (error) {
    // Tab might be closed
  }
}

/**
 * Get cookies for a URL
 */
async function getCookiesForUrl(url) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map(c => ({ name: c.name, value: c.value }));
  } catch {
    return [];
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const tabId = sender.tab?.id;
  
  switch (message.type) {
    case 'GET_DETECTORS':
      return { detectors };
      
    case 'GET_DETECTIONS': {
      const cacheKey = message.url || sender.tab?.url;
      
      // Check cache first
      const cached = detectionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { detections: cached.detections };
      }
      
      return { detections: [] };
    }
    
    case 'PAGE_DATA': {
      const url = message.data?.url || sender.tab?.url;
      
      // Add cookies to page data
      if (url) {
        message.data.cookies = await getCookiesForUrl(url);
      }
      
      // Run detection
      const detections = await runDetection(message.data);
      
      // Cache results
      detectionCache.set(url, {
        detections,
        timestamp: Date.now()
      });
      
      // Update badge
      if (tabId) {
        await updateBadge(tabId, detections.length);
      }
      
      return { success: true, detections };
    }
    
    case 'PAGE_LOAD_NOTIFICATION': {
      const url = message.url;
      
      // Check cache
      const cached = detectionCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        // Update badge from cache
        if (tabId) {
          await updateBadge(tabId, cached.detections.length);
        }
        return { cacheHit: true };
      }
      
      // Request page data collection
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_DATA' });
      } catch {
        // Tab might not have content script
      }
      
      return { cacheHit: false };
    }
    
    case 'RUN_DETECTION': {
      // Force rescan - clear cache for this URL
      const url = message.url;
      detectionCache.delete(url);
      
      try {
        await chrome.tabs.sendMessage(message.tabId || tabId, { type: 'REQUEST_PAGE_DATA' });
      } catch {
        // Tab might not have content script
      }
      
      return { success: true };
    }
    
    case 'JS_HOOK_BATCH': {
      // Handle batched JS hook detections
      const url = sender.tab?.url;
      if (!url) return { success: false };
      
      // Get or create cache entry
      let cached = detectionCache.get(url);
      if (!cached) {
        cached = { detections: [], timestamp: Date.now(), jsHooks: [] };
      }
      
      // Add new hooks
      if (!cached.jsHooks) cached.jsHooks = [];
      for (const hook of message.hooks || []) {
        if (!cached.jsHooks.includes(hook.target)) {
          cached.jsHooks.push(hook.target);
        }
      }
      
      detectionCache.set(url, cached);
      
      return { success: true };
    }
    
    case 'CLEAR_CACHE':
      detectionCache.clear();
      await chrome.storage.local.remove(
        Object.keys(await chrome.storage.local.get(null))
          .filter(key => key.startsWith('detection_'))
      );
      return { success: true };
      
    case 'TOGGLE_EXTENSION': {
      await chrome.storage.local.set({ scrappey_enabled: message.enabled });
      return { success: true };
    }
    
    case 'CHECK_CACHE_EARLY': {
      const cached = detectionCache.get(message.url);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { cacheHit: true, detectionData: cached };
      }
      return { cacheHit: false };
    }
    
    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Handle tab updates - trigger detection on page load
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Trigger detection when page starts loading (to inject early)
  if (changeInfo.status === 'loading' && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    // Clear stale cache for this URL to get fresh detection
    // Don't clear completely, just mark for refresh
  }
  
  // When page completes, ensure detection runs
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
    console.log('[Scrappey] Tab complete, checking detection for:', tab.url);
    
    // Check if we have cached detections
    const cached = detectionCache.get(tab.url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      await updateBadge(tabId, cached.detections.length);
    } else {
      // No cache or stale, request fresh detection
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_DATA' });
      } catch (error) {
        // Content script might not be ready yet, retry after delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_DATA' });
          } catch {
            // Give up if still failing
          }
        }, 1000);
      }
    }
  }
});

/**
 * Handle tab activation
 */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      const cached = detectionCache.get(tab.url);
      await updateBadge(tabId, cached?.detections?.length || 0);
    }
  } catch {
    // Tab might not exist
  }
});

// Initialize on load
initialize();

