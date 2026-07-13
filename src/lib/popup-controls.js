(function publishPopupControls(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PopupControls = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createExports() {
  const urlUtils = typeof require === 'function'
    ? require('./url-utils')
    : globalThis.BoardroomUrlUtils;

  function normalizeBrowserUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) {
      return { success: false, reason: 'missing-url' };
    }

    const hasUnsafeScheme = urlUtils.hasSchemeLikePrefix(raw) && !urlUtils.looksLikeHostPort(raw);
    const candidate = hasUnsafeScheme ? raw : `https://${raw}`;

    try {
      const parsed = new URL(candidate);
      if (!urlUtils.isBrowserSafeUrl(parsed.href)) {
        return { success: false, reason: 'unsafe-url' };
      }
      return { success: true, url: parsed.href };
    } catch (error) {
      return { success: false, reason: 'invalid-url' };
    }
  }

  function createPopupController(options) {
    const initial = normalizeBrowserUrl(options && options.initialUrl);
    const state = {
      addressText: initial.success ? initial.url : String((options && options.initialUrl) || ''),
      canGoBack: false,
      canGoForward: false,
      currentUrl: initial.success ? initial.url : '',
      error: initial.success ? '' : initial.reason,
      title: (options && options.title) || 'Popup'
    };

    function snapshot() {
      return { ...state };
    }

    function submitAddress(input) {
      const normalized = normalizeBrowserUrl(input);
      state.addressText = String(input || '').trim();

      if (!normalized.success) {
        state.error = normalized.reason;
        return { success: false, reason: normalized.reason, state: snapshot() };
      }

      state.addressText = normalized.url;
      state.currentUrl = normalized.url;
      state.error = '';
      return { success: true, url: normalized.url, state: snapshot() };
    }

    function updateNavigationState(nextState) {
      if (nextState.url) {
        state.currentUrl = nextState.url;
        state.addressText = nextState.url;
      }

      if (typeof nextState.canGoBack === 'boolean') {
        state.canGoBack = nextState.canGoBack;
      }

      if (typeof nextState.canGoForward === 'boolean') {
        state.canGoForward = nextState.canGoForward;
      }

      if (nextState.title) {
        state.title = nextState.title;
      }

      state.error = '';
      return snapshot();
    }

    return {
      getState: snapshot,
      submitAddress,
      updateNavigationState
    };
  }

  return {
    createPopupController,
    normalizeBrowserUrl
  };
}));
