(function publishUrlUtils(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.BoardroomUrlUtils = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createExports() {
  function getUrlProtocol(url) {
    try {
      return new URL(String(url)).protocol;
    } catch (error) {
      return null;
    }
  }

  function isBrowserSafeUrl(url) {
    return new Set(['http:', 'https:']).has(getUrlProtocol(url));
  }

  function hasSchemeLikePrefix(value) {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  }

  function looksLikeHostPort(value) {
    return /^[^/\s:]+:\d+(?:\/|$)/.test(value);
  }

  return {
    getUrlProtocol,
    hasSchemeLikePrefix,
    isBrowserSafeUrl,
    looksLikeHostPort
  };
}));
