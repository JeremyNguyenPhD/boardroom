const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildWebviewContextMenuTemplate,
  copyLinkToClipboard,
  isBrowserSafeUrl,
  openBrowserUrlExternal
} = require('../src/lib/link-actions');

function createDependencies() {
  const calls = {
    clipboard: [],
    shell: []
  };

  return {
    calls,
    clipboard: {
      writeText: (text) => calls.clipboard.push(text)
    },
    shell: {
      openExternal: async (url) => calls.shell.push(url)
    }
  };
}

test('builds link actions before text-editing actions for browser-safe links', () => {
  const deps = createDependencies();
  const template = buildWebviewContextMenuTemplate({
    linkURL: 'https://example.com/source',
    selectionText: 'selected text',
    isEditable: true
  }, deps);

  assert.deepEqual(template.slice(0, 2).map(item => item.label), [
    'Copy Link',
    'Open Link in Browser'
  ]);
  assert.equal(template.find(item => item.role === 'copy').label, 'Copy');
  assert.equal(template.find(item => item.role === 'cut').label, 'Cut');
  assert.equal(template.find(item => item.role === 'paste').label, 'Paste');
  assert.equal(template.find(item => item.role === 'selectAll').label, 'Select All');
});

test('keeps selection copy menu without link actions when no link is present', () => {
  const deps = createDependencies();
  const template = buildWebviewContextMenuTemplate({
    linkURL: '',
    selectionText: 'selected text',
    isEditable: false
  }, deps);

  assert.equal(template.some(item => item.label === 'Copy Link'), false);
  assert.equal(template.some(item => item.label === 'Open Link in Browser'), false);
  assert.equal(template.find(item => item.role === 'copy').label, 'Copy');
});

test('keeps cut and paste actions available in editable fields', () => {
  const deps = createDependencies();
  const template = buildWebviewContextMenuTemplate({
    linkURL: '',
    selectionText: '',
    isEditable: true
  }, deps);

  assert.equal(template.find(item => item.role === 'cut').enabled, false);
  assert.equal(template.find(item => item.role === 'paste').label, 'Paste');
  assert.equal(template.find(item => item.role === 'selectAll').label, 'Select All');
});

test('refuses to open non-browser URL schemes externally', async () => {
  const deps = createDependencies();
  const result = await openBrowserUrlExternal(deps.shell, 'javascript:alert(1)');

  assert.deepEqual(result, { success: false, reason: 'unsafe-url' });
  assert.deepEqual(deps.calls.shell, []);
});

test('disables external-open menu item for non-browser URL schemes', () => {
  const deps = createDependencies();
  const template = buildWebviewContextMenuTemplate({
    linkURL: 'javascript:alert(1)',
    selectionText: '',
    isEditable: false
  }, deps);

  assert.equal(template.find(item => item.label === 'Open Link in Browser').enabled, false);
});

test('copies non-browser URL schemes without opening them', () => {
  const deps = createDependencies();
  const result = copyLinkToClipboard(deps.clipboard, 'mailto:person@example.com');

  assert.deepEqual(result, { success: true, url: 'mailto:person@example.com' });
  assert.deepEqual(deps.calls.clipboard, ['mailto:person@example.com']);
});

test('copies and opens valid browser links with exact URL text', async () => {
  const deps = createDependencies();
  const url = 'https://example.com/path?q=1#anchor';

  assert.equal(isBrowserSafeUrl(url), true);
  assert.deepEqual(copyLinkToClipboard(deps.clipboard, url), { success: true, url });
  assert.deepEqual(await openBrowserUrlExternal(deps.shell, url), { success: true, url });
  assert.deepEqual(deps.calls.clipboard, [url]);
  assert.deepEqual(deps.calls.shell, [url]);
});
