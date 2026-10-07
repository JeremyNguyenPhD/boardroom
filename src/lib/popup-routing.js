const CLAUDE_PARTITION = 'persist:claude';
const CLAUDE_ORIGIN = 'https://claude.ai';
const GOOGLE_ACCOUNTS_ORIGIN = 'https://accounts.google.com';

function getHttpsOrigin(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function shouldUseNativeAuthPopup(partition, popupUrl, openerUrl) {
  if (partition !== CLAUDE_PARTITION) {
    return false;
  }

  const popupOrigin = getHttpsOrigin(popupUrl);
  const openerOrigin = getHttpsOrigin(openerUrl);
  return popupOrigin === GOOGLE_ACCOUNTS_ORIGIN &&
    (openerOrigin === CLAUDE_ORIGIN || openerOrigin === GOOGLE_ACCOUNTS_ORIGIN);
}

function safeFailureMessage(value, fallback) {
  try {
    const message = typeof value === 'string'
      ? value
      : value && typeof value.message === 'string'
        ? value.message
        : fallback;
    return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
  } catch {
    return fallback;
  }
}

function createWindowOpenHandler({
  partition,
  getOpenerUrl,
  session,
  openControlledPopup,
  onControlledPopupError = () => {}
}) {
  const reportControlledPopupFailure = (failure, fallback) => {
    onControlledPopupError(safeFailureMessage(failure, fallback));
  };

  return ({ url }) => {
    if (shouldUseNativeAuthPopup(partition, url, getOpenerUrl())) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 800,
          height: 700,
          title: 'Claude sign-in',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            session
          }
        }
      };
    }

    try {
      Promise.resolve(openControlledPopup(url, partition)).then((result) => {
        if (!result || result.success !== true) {
          reportControlledPopupFailure(
            result && result.error,
            'Controlled popup returned an invalid result.'
          );
        }
      }, (error) => {
        reportControlledPopupFailure(error, 'Controlled popup was rejected.');
      });
    } catch (error) {
      reportControlledPopupFailure(error, 'Controlled popup failed before opening.');
    }

    return { action: 'deny' };
  };
}

module.exports = {
  createWindowOpenHandler,
  shouldUseNativeAuthPopup
};
