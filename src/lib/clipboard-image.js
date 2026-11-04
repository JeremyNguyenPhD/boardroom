(function publishClipboardImage(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.BoardroomClipboardImage = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createExports() {
  // Same ceiling as the paperclip file dialog in src/main.js.
  const MAX_PASTED_IMAGE_BYTES = 25 * 1024 * 1024;

  const EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/tiff': 'tiff',
    'image/bmp': 'bmp'
  };

  // Returns the first image File on the clipboard, or null.
  // When plain text is also present (for example a selection copied from Word,
  // Excel or a web page, which also carries a picture of that selection), the
  // user almost certainly meant to paste the text, so no image is taken.
  function pickPastedImage(clipboardData) {
    if (!clipboardData) return null;
    const types = Array.from(clipboardData.types || []);
    if (types.includes('text/plain')) return null;

    const items = Array.from(clipboardData.items || []);
    for (const item of items) {
      if (item && item.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    return null;
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  // Clipboard screenshots arrive named "image.png"; give them a readable,
  // timestamped name so they are distinguishable in each provider's chat.
  function buildPastedImageName(mimeType, date) {
    const ext = EXTENSIONS[mimeType] || 'png';
    const d = date || new Date();
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
    return `Pasted image ${stamp}.${ext}`;
  }

  function dataUrlToBase64(dataUrl) {
    const comma = String(dataUrl).indexOf(',');
    if (comma === -1) throw new Error('Clipboard image could not be read');
    return String(dataUrl).slice(comma + 1);
  }

  // Builds the same attachment shape the file dialog returns:
  // { name, path, base64, size, mimeType } or { error }.
  function buildAttachmentFromImage(file, base64, date) {
    if (file.size > MAX_PASTED_IMAGE_BYTES) {
      return { error: 'Pasted image too large. Maximum size is 25MB.' };
    }
    const mimeType = file.type || 'image/png';
    return {
      name: buildPastedImageName(mimeType, date),
      path: null,
      base64,
      size: file.size,
      mimeType
    };
  }

  return {
    MAX_PASTED_IMAGE_BYTES,
    buildAttachmentFromImage,
    buildPastedImageName,
    dataUrlToBase64,
    pickPastedImage
  };
}));
