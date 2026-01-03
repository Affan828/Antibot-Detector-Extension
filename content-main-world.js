/**
 * Scrappey Bot Detector - Content Script (MAIN World)
 * Installs JS hooks and detects window properties
 * Runs in the same context as the page for API interception
 */

(function() {
  'use strict';
  
  // Prevent duplicate initialization
  if (window.__scrappeyMainWorldInit) return;
  window.__scrappeyMainWorldInit = true;
  
  // Store detected hooks and props
  const detectedHooks = new Set();
  const detectedProps = new Set();
  
  /**
   * Report a JS hook detection to the ISOLATED world
   */
  function reportHook(target) {
    if (detectedHooks.has(target)) return;
    detectedHooks.add(target);
    
    window.postMessage({
      type: 'SCRAPPEY_JS_HOOK',
      target: target
    }, '*');
  }
  
  /**
   * Report a window property detection
   */
  function reportWindowProp(path) {
    if (detectedProps.has(path)) return;
    detectedProps.add(path);
    
    window.postMessage({
      type: 'SCRAPPEY_WINDOW_PROP',
      path: path
    }, '*');
  }
  
  /**
   * Hook a prototype method
   */
  function hookMethod(proto, methodName, hookId) {
    const original = proto[methodName];
    if (typeof original !== 'function') return;
    
    proto[methodName] = function(...args) {
      reportHook(hookId);
      return original.apply(this, args);
    };
  }
  
  /**
   * Install fingerprinting detection hooks
   */
  function installHooks() {
    try {
      // Canvas fingerprinting
      hookMethod(
        HTMLCanvasElement.prototype,
        'toDataURL',
        'HTMLCanvasElement.prototype.toDataURL'
      );
      
      hookMethod(
        HTMLCanvasElement.prototype,
        'toBlob',
        'HTMLCanvasElement.prototype.toBlob'
      );
      
      if (typeof CanvasRenderingContext2D !== 'undefined') {
        hookMethod(
          CanvasRenderingContext2D.prototype,
          'getImageData',
          'CanvasRenderingContext2D.prototype.getImageData'
        );
      }
      
      // WebGL fingerprinting
      if (typeof WebGLRenderingContext !== 'undefined') {
        hookMethod(
          WebGLRenderingContext.prototype,
          'getParameter',
          'WebGLRenderingContext.prototype.getParameter'
        );
        
        hookMethod(
          WebGLRenderingContext.prototype,
          'getExtension',
          'WebGLRenderingContext.prototype.getExtension'
        );
      }
      
      if (typeof WebGL2RenderingContext !== 'undefined') {
        hookMethod(
          WebGL2RenderingContext.prototype,
          'getParameter',
          'WebGL2RenderingContext.prototype.getParameter'
        );
      }
      
      // Audio fingerprinting
      if (typeof AudioContext !== 'undefined') {
        hookMethod(
          AudioContext.prototype,
          'createOscillator',
          'AudioContext.prototype.createOscillator'
        );
        
        hookMethod(
          AudioContext.prototype,
          'createAnalyser',
          'AudioContext.prototype.createAnalyser'
        );
      }
      
      if (typeof OfflineAudioContext !== 'undefined') {
        hookMethod(
          OfflineAudioContext.prototype,
          'startRendering',
          'OfflineAudioContext.prototype.startRendering'
        );
      }
      
      // Font fingerprinting
      if (typeof document.fonts !== 'undefined' && document.fonts.check) {
        const originalCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function(font, text) {
          reportHook('FontFaceSet.prototype.check');
          return originalCheck(font, text);
        };
      }
      
      // Navigator properties
      const navigatorProps = [
        'userAgent', 'platform', 'language', 'languages',
        'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints'
      ];
      
      for (const prop of navigatorProps) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
          if (descriptor && descriptor.get) {
            const originalGet = descriptor.get;
            Object.defineProperty(Navigator.prototype, prop, {
              get: function() {
                reportHook(`Navigator.prototype.${prop}`);
                return originalGet.call(this);
              },
              configurable: true
            });
          }
        } catch {
          // Some properties might not be configurable
        }
      }
      
      // Screen properties
      const screenProps = ['width', 'height', 'colorDepth', 'pixelDepth', 'availWidth', 'availHeight'];
      
      for (const prop of screenProps) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
          if (descriptor && descriptor.get) {
            const originalGet = descriptor.get;
            Object.defineProperty(Screen.prototype, prop, {
              get: function() {
                reportHook(`Screen.prototype.${prop}`);
                return originalGet.call(this);
              },
              configurable: true
            });
          }
        } catch {
          // Some properties might not be configurable
        }
      }
      
      // WebRTC fingerprinting
      if (typeof RTCPeerConnection !== 'undefined') {
        hookMethod(
          RTCPeerConnection.prototype,
          'createDataChannel',
          'RTCPeerConnection.prototype.createDataChannel'
        );
        
        hookMethod(
          RTCPeerConnection.prototype,
          'createOffer',
          'RTCPeerConnection.prototype.createOffer'
        );
      }
      
      // Battery API
      if (navigator.getBattery) {
        const originalGetBattery = navigator.getBattery.bind(navigator);
        navigator.getBattery = function() {
          reportHook('Navigator.prototype.getBattery');
          return originalGetBattery();
        };
      }
      
      // Performance API
      if (typeof Performance !== 'undefined') {
        hookMethod(
          Performance.prototype,
          'now',
          'Performance.prototype.now'
        );
      }
      
    } catch (error) {
      console.warn('[Scrappey] Error installing hooks:', error);
    }
  }
  
  /**
   * Check for known anti-bot window properties
   */
  function checkWindowProperties() {
    const propsToCheck = [
      // Cloudflare
      '_cf_chl_opt',
      'turnstile',
      '__cf_chl_ctx',
      
      // reCAPTCHA
      'grecaptcha',
      '___grecaptcha_cfg',
      
      // hCaptcha
      'hcaptcha',
      
      // DataDome
      'ddjskey',
      'datadome',
      
      // PerimeterX
      '_pxUuid',
      '_pxVid',
      'PX',
      
      // Akamai
      'bmak',
      '_abck',
      
      // Kasada
      'KPSDK',
      
      // Shape Security
      '__fp',
      
      // Incapsula/Imperva
      'reese84',
      
      // GeeTest
      'initGeetest',
      'initGeetest4',
      
      // FunCaptcha
      'ArkoseEnforcement',
      'fc_callback'
    ];
    
    for (const prop of propsToCheck) {
      try {
        if (window[prop] !== undefined) {
          reportWindowProp(prop);
        }
      } catch {
        // Access might be restricted
      }
    }
  }
  
  // Install hooks immediately
  installHooks();
  
  // Check window properties after page loads
  if (document.readyState === 'complete') {
    setTimeout(checkWindowProperties, 100);
  } else {
    window.addEventListener('load', () => {
      setTimeout(checkWindowProperties, 500);
    }, { once: true });
  }
  
  // Also check after a delay for lazy-loaded scripts
  setTimeout(checkWindowProperties, 2000);
  setTimeout(checkWindowProperties, 5000);
  
})();

