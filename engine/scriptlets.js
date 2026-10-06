/**
 * Scriptlets - Defusers and surrogates inspired by uBlock Origin scriptlet library.
 * These scripts are injected into the page's MAIN execution world to defuse anti-adblock
 * scripts, tracking beacons, and inline traps.
 */

export const SCRIPTLET_DEFINITIONS = {
  /**
   * Prevents execution of eval()
   */
  'noeval': function() {
    try {
      window.eval = function() {
        console.warn('[AdBlock] eval() call neutralized.');
        return undefined;
      };
    } catch (e) {}
  },

  /**
   * Neutralizes BlockAdBlock / FuckAdBlock detection script
   */
  'prevent-bab': function() {
    try {
      const noop = function() {};
      const fakeBab = {
        check: noop,
        clearEvent: noop,
        on: function(isDetected, fn) {
          if (!isDetected && typeof fn === 'function') {
            try { fn(); } catch (e) {}
          }
          return this;
        },
        onDetected: noop,
        onNotDetected: function(fn) {
          if (typeof fn === 'function') {
            try { fn(); } catch (e) {}
          }
          return this;
        }
      };
      window.BlockAdBlock = fakeBab;
      window.blockAdBlock = fakeBab;
      window.FuckAdBlock = fakeBab;
      window.fuckAdBlock = fakeBab;
    } catch (e) {}
  },

  /**
   * Aborts script execution when a specific property is read
   */
  'abort-on-property-read': function(prop) {
    if (!prop) return;
    try {
      let target = window;
      const parts = prop.split('.');
      const last = parts.pop();
      for (const part of parts) {
        if (!target[part]) target[part] = {};
        target = target[part];
      }
      Object.defineProperty(target, last, {
        get: function() {
          throw new ReferenceError('[AdBlock] Blocked property read: ' + prop);
        },
        set: function() {},
        configurable: true
      });
    } catch (e) {}
  },

  /**
   * Aborts script execution when a specific property is written
   */
  'abort-on-property-write': function(prop) {
    if (!prop) return;
    try {
      let target = window;
      const parts = prop.split('.');
      const last = parts.pop();
      for (const part of parts) {
        if (!target[part]) target[part] = {};
        target = target[part];
      }
      Object.defineProperty(target, last, {
        get: function() { return undefined; },
        set: function() {
          throw new ReferenceError('[AdBlock] Blocked property write: ' + prop);
        },
        configurable: true
      });
    } catch (e) {}
  },

  /**
   * Sets a localStorage item (e.g. to mock anti-adblock dismissed state)
   */
  'set-local-storage-item': function(key, value) {
    if (!key) return;
    try {
      window.localStorage.setItem(key, value !== undefined ? value : 'true');
    } catch (e) {}
  },

  /**
   * Replaces a function property with a no-op function
   */
  'nano-noop': function(prop) {
    if (!prop) return;
    try {
      let target = window;
      const parts = prop.split('.');
      const last = parts.pop();
      for (const part of parts) {
        if (!target[part]) target[part] = {};
        target = target[part];
      }
      target[last] = function() {};
    } catch (e) {}
  },

  /**
   * Intercepts fetch() requests matching a pattern and cancels/rejects them
   */
  'prevent-fetch': function(pattern) {
    if (!pattern) return;
    try {
      const originalFetch = window.fetch;
      window.fetch = function(resource, init) {
        const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
        if (url && url.includes(pattern)) {
          console.warn('[AdBlock] Blocked fetch to: ' + url);
          return Promise.reject(new TypeError('Network request blocked by AdBlock'));
        }
        return originalFetch.apply(this, arguments);
      };
    } catch (e) {}
  }
};

/**
 * Generates executable code string for a scriptlet call.
 * @param {string} name - Scriptlet name
 * @param {Array<string>} args - Scriptlet arguments
 * @returns {string|null}
 */
export function generateScriptletCode(name, args = []) {
  const fn = SCRIPTLET_DEFINITIONS[name];
  if (!fn) return null;

  const argsJson = JSON.stringify(args);
  return `(function() {
    try {
      const fn = ${fn.toString()};
      fn.apply(null, ${argsJson});
    } catch(err) {
      console.warn('[AdBlock Scriptlet error]', err);
    }
  })();`;
}
