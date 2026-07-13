const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function createElement(id) {
  const listeners = {};
  return {
    id,
    disabled: false,
    src: '',
    textContent: '',
    value: '',
    attributes: {},
    addEventListener: (eventName, handler) => {
      listeners[eventName] = listeners[eventName] || [];
      listeners[eventName].push(handler);
    },
    dispatch: (eventName, event = {}) => {
      for (const handler of listeners[eventName] || []) {
        handler(event);
      }
    },
    setAttribute: function setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

function loadPopupPage(search = '?url=https%3A%2F%2Fexample.com%2Fstart&title=Popup&partition=persist%3Achatgpt') {
  const elements = {};
  for (const id of ['popup-webview', 'address', 'address-form', 'back', 'forward', 'reload', 'copy-url', 'open-url', 'error']) {
    elements[id] = createElement(id);
  }

  const calls = {
    copyText: [],
    goBack: 0,
    goForward: 0,
    loadURL: [],
    openExternal: [],
    preventDefault: 0,
    reload: 0
  };

  const webview = elements['popup-webview'];
  webview.currentUrl = 'https://example.com/start';
  webview.canGoBack = () => true;
  webview.canGoForward = () => false;
  webview.getURL = () => webview.currentUrl;
  webview.goBack = () => { calls.goBack += 1; };
  webview.goForward = () => { calls.goForward += 1; };
  webview.reload = () => { calls.reload += 1; };
  webview.loadURL = (url) => {
    calls.loadURL.push(url);
    webview.currentUrl = url;
  };

  const context = {
    console,
    document: {
      title: '',
      getElementById: (id) => elements[id]
    },
    electronAPI: {
      copyText: (text) => calls.copyText.push(text),
      openExternal: (url) => calls.openExternal.push(url)
    },
    globalThis: {},
    location: { search },
    module: undefined,
    require: undefined,
    URL,
    URLSearchParams,
    window: null
  };
  context.globalThis = context;
  context.window = context;

  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/lib/url-utils.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/lib/popup-controls.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/lib/popup-page.js'), 'utf8'), context);

  return { calls, elements };
}

test('initializes popup webview partition and URL without launching Electron', () => {
  const { elements } = loadPopupPage();

  assert.equal(elements.address.value, 'https://example.com/start');
  assert.equal(elements['popup-webview'].attributes.partition, 'persist:chatgpt');
  assert.equal(elements['popup-webview'].src, 'https://example.com/start');
});

test('submitting the address navigates the embedded webview', () => {
  const { calls, elements } = loadPopupPage();
  elements.address.value = 'example.org/docs';

  elements['address-form'].dispatch('submit', {
    preventDefault: () => { calls.preventDefault += 1; }
  });

  assert.equal(calls.preventDefault, 1);
  assert.deepEqual(calls.loadURL, ['https://example.org/docs']);
  assert.equal(elements.address.value, 'https://example.org/docs');
});

test('navigation events do not overwrite an in-progress address edit', () => {
  const { elements } = loadPopupPage();
  elements.address.value = 'draft.example/path';
  elements.address.dispatch('input');

  elements['popup-webview'].currentUrl = 'https://example.com/next';
  elements['popup-webview'].dispatch('did-navigate', { title: 'Next' });

  assert.equal(elements.address.value, 'draft.example/path');
});

test('copy, open, and navigation buttons call the expected APIs', () => {
  const { calls, elements } = loadPopupPage();

  elements['copy-url'].dispatch('click');
  elements.address.value = 'example.net:8443/path';
  elements.address.dispatch('blur');
  elements['open-url'].dispatch('click');
  elements.back.dispatch('click');
  elements.forward.dispatch('click');
  elements.reload.dispatch('click');

  assert.deepEqual(calls.copyText, ['https://example.com/start']);
  assert.deepEqual(calls.openExternal, ['https://example.net:8443/path']);
  assert.equal(calls.goBack, 1);
  assert.equal(calls.goForward, 0);
  assert.equal(calls.reload, 1);
});

test('popup new-window always prevents default and routes valid URLs', () => {
  const { calls, elements } = loadPopupPage();

  elements['popup-webview'].dispatch('new-window', {
    url: '',
    preventDefault: () => { calls.preventDefault += 1; }
  });
  elements['popup-webview'].dispatch('new-window', {
    url: 'https://example.com/popout',
    preventDefault: () => { calls.preventDefault += 1; }
  });

  assert.equal(calls.preventDefault, 2);
  assert.deepEqual(calls.loadURL, ['https://example.com/popout']);
});
