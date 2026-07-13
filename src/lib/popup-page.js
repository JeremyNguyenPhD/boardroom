const params = new URLSearchParams(window.location.search);
const initialUrl = params.get('url') || '';
const initialTitle = params.get('title') || 'Popup';
const partition = params.get('partition') || 'persist:popup';
const controller = window.PopupControls.createPopupController({
  initialUrl,
  title: initialTitle
});

const webview = document.getElementById('popup-webview');
const address = document.getElementById('address');
const addressForm = document.getElementById('address-form');
const backButton = document.getElementById('back');
const forwardButton = document.getElementById('forward');
const reloadButton = document.getElementById('reload');
const copyButton = document.getElementById('copy-url');
const openButton = document.getElementById('open-url');
const errorMessage = document.getElementById('error');
let addressIsDirty = false;

function render(options = {}) {
  const state = controller.getState();
  if (options.forceAddress || !addressIsDirty) {
    address.value = state.addressText;
  }
  backButton.disabled = !state.canGoBack;
  forwardButton.disabled = !state.canGoForward;
  errorMessage.textContent = state.error ? 'Enter an http:// or https:// URL.' : '';
  document.title = state.title || 'Boardroom Popup';
}

function reportWebviewState(event) {
  controller.updateNavigationState({
    url: webview.getURL(),
    canGoBack: webview.canGoBack(),
    canGoForward: webview.canGoForward(),
    title: event && event.title
  });
  render();
}

function navigateTo(input) {
  const result = controller.submitAddress(input);
  addressIsDirty = false;
  render({ forceAddress: true });

  if (result.success) {
    webview.loadURL(result.url);
  }
}

address.addEventListener('input', () => {
  addressIsDirty = true;
});

address.addEventListener('blur', () => {
  addressIsDirty = false;
});

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  navigateTo(address.value);
});

backButton.addEventListener('click', () => {
  if (webview.canGoBack()) {
    webview.goBack();
  }
});

forwardButton.addEventListener('click', () => {
  if (webview.canGoForward()) {
    webview.goForward();
  }
});

reloadButton.addEventListener('click', () => {
  webview.reload();
});

copyButton.addEventListener('click', () => {
  window.electronAPI.copyText(address.value);
});

openButton.addEventListener('click', () => {
  const result = controller.submitAddress(address.value);
  addressIsDirty = false;
  render({ forceAddress: true });

  if (result.success) {
    window.electronAPI.openExternal(result.url);
  }
});

webview.addEventListener('did-navigate', reportWebviewState);
webview.addEventListener('did-navigate-in-page', reportWebviewState);
webview.addEventListener('did-finish-load', reportWebviewState);
webview.addEventListener('page-title-updated', reportWebviewState);
webview.addEventListener('new-window', (event) => {
  event.preventDefault();
  if (event.url) {
    navigateTo(event.url);
  }
});

render();
if (controller.getState().currentUrl) {
  webview.setAttribute('partition', partition);
  webview.src = controller.getState().currentUrl;
}
