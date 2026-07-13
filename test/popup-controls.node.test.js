const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPopupController,
  normalizeBrowserUrl
} = require('../src/lib/popup-controls');

test('initializes popup state from an initial URL', () => {
  const controller = createPopupController({
    initialUrl: 'https://example.com/start',
    title: 'Example'
  });

  assert.deepEqual(controller.getState(), {
    addressText: 'https://example.com/start',
    canGoBack: false,
    canGoForward: false,
    currentUrl: 'https://example.com/start',
    error: '',
    title: 'Example'
  });
});

test('normalizes user-submitted bare hostnames to browser-safe HTTPS URLs', () => {
  const controller = createPopupController({ initialUrl: 'https://example.com/' });
  const result = controller.submitAddress('example.org/docs');

  assert.equal(result.success, true);
  assert.equal(result.url, 'https://example.org/docs');
  assert.equal(controller.getState().addressText, 'https://example.org/docs');
});

test('updates address state after remote navigation changes', () => {
  const controller = createPopupController({ initialUrl: 'https://example.com/' });
  const state = controller.updateNavigationState({
    url: 'https://example.com/next',
    canGoBack: true,
    canGoForward: false,
    title: 'Next Page'
  });

  assert.equal(state.currentUrl, 'https://example.com/next');
  assert.equal(state.addressText, 'https://example.com/next');
  assert.equal(state.canGoBack, true);
  assert.equal(state.canGoForward, false);
  assert.equal(state.title, 'Next Page');
});

test('keeps reload available while back and forward state follow webview history', () => {
  const controller = createPopupController({ initialUrl: 'https://example.com/' });
  const state = controller.updateNavigationState({
    url: 'https://example.com/',
    canGoBack: false,
    canGoForward: false
  });

  assert.equal(state.canGoBack, false);
  assert.equal(state.canGoForward, false);
});

test('rejects non-browser URL schemes for popup navigation', () => {
  const controller = createPopupController({ initialUrl: 'https://example.com/' });
  const result = controller.submitAddress('javascript:alert(1)');

  assert.deepEqual({
    success: result.success,
    reason: result.reason,
    currentUrl: controller.getState().currentUrl,
    error: controller.getState().error
  }, {
    success: false,
    reason: 'unsafe-url',
    currentUrl: 'https://example.com/',
    error: 'unsafe-url'
  });
});

test('normalizes common bare host and port addresses', () => {
  assert.equal(normalizeBrowserUrl('localhost:3000').url, 'https://localhost:3000/');
  assert.equal(normalizeBrowserUrl('example.com:8443/path').url, 'https://example.com:8443/path');
});

test('reports missing and malformed popup URLs', () => {
  assert.deepEqual(normalizeBrowserUrl(''), { success: false, reason: 'missing-url' });
  assert.deepEqual(normalizeBrowserUrl('https://'), { success: false, reason: 'invalid-url' });
});

test('normalizes only http and https browser URLs', () => {
  assert.deepEqual(normalizeBrowserUrl('http://example.com/a'), {
    success: true,
    url: 'http://example.com/a'
  });
  assert.deepEqual(normalizeBrowserUrl('https://example.com/a'), {
    success: true,
    url: 'https://example.com/a'
  });
  assert.deepEqual(normalizeBrowserUrl('mailto:person@example.com'), {
    success: false,
    reason: 'unsafe-url'
  });
});
