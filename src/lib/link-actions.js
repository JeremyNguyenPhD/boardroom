const {
  getUrlProtocol,
  isBrowserSafeUrl
} = require('./url-utils');

function copyLinkToClipboard(clipboard, url) {
  if (!url) {
    return { success: false, reason: 'missing-url' };
  }

  clipboard.writeText(String(url));
  return { success: true, url: String(url) };
}

async function openBrowserUrlExternal(shell, url) {
  if (!isBrowserSafeUrl(url)) {
    return { success: false, reason: 'unsafe-url' };
  }

  const safeUrl = String(url);
  await shell.openExternal(safeUrl);
  return { success: true, url: safeUrl };
}

function buildWebviewContextMenuTemplate(params, dependencies) {
  const { clipboard, shell } = dependencies;
  const selectionText = params.selectionText || '';
  const isEditable = Boolean(params.isEditable);
  const linkURL = params.linkURL || '';
  const template = [];

  if (linkURL) {
    template.push(
      {
        label: 'Copy Link',
        click: () => copyLinkToClipboard(clipboard, linkURL)
      },
      {
        label: 'Open Link in Browser',
        enabled: isBrowserSafeUrl(linkURL),
        click: () => {
          openBrowserUrlExternal(shell, linkURL).catch((error) => {
            console.error('Failed to open link in browser:', error);
          });
        }
      }
    );
  }

  if (selectionText) {
    if (template.length > 0) {
      template.push({ type: 'separator' });
    }
    template.push({
      label: 'Copy',
      role: 'copy'
    });
  }

  if (isEditable) {
    if (template.length > 0) {
      template.push({ type: 'separator' });
    }
    template.push(
      {
        label: 'Cut',
        role: 'cut',
        enabled: selectionText.length > 0
      },
      {
        label: 'Paste',
        role: 'paste'
      }
    );
  }

  if (selectionText || isEditable) {
    template.push(
      { type: 'separator' },
      {
        label: 'Select All',
        role: 'selectAll'
      }
    );
  }

  return template;
}

module.exports = {
  buildWebviewContextMenuTemplate,
  copyLinkToClipboard,
  getUrlProtocol,
  isBrowserSafeUrl,
  openBrowserUrlExternal
};
