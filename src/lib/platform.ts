/**
 * Platform detection utilities for native app integration
 */

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).__NATIVE_APP__ === true;
}

export function getPlatform(): 'web' | 'ios' | 'android' {
  if (typeof window === 'undefined') return 'web';
  return (window as any).__PLATFORM__ || 'web';
}

export function isIpad(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).__IS_IPAD__ === true;
}

export function isIpadApp(): boolean {
  if (typeof window === 'undefined') return false;
  return isNativeApp() && getPlatform() === 'ios' && isIpad();
}

/**
 * Setup message bridge between web app and native wrapper
 */
export function setupNativeAppBridge() {
  if (typeof window === 'undefined') return;

  // Listen for messages from native app
  window.addEventListener('message', (event) => {
    try {
      // Handle both string and object messages
      const message = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data;

      if (!message || typeof message !== 'object') return;

      switch (message.type) {
        case 'DEVICE_INFO':
          // Mark as native app
          (window as any).__NATIVE_APP__ = message.isNativeApp;
          (window as any).__PLATFORM__ = message.platform;
          (window as any).__IS_IPAD__ = message.isIpad;

          // Add CSS class for native-specific styling
          if (message.isNativeApp) {
            document.body.classList.add('native-app');
            document.body.classList.add(`platform-${message.platform}`);

            // Add iPad-specific class
            if (message.isIpad) {
              document.body.classList.add('platform-ipad');
            }
          }

          console.log('Native app detected:', message.platform, 'iPad:', message.isIpad);
          break;

        case 'SCRIPTS_READY':
        case 'SCRIPTS_READY_ACK':
          break;

        case 'TOKEN_LOADED':
          // Handle auth token from native storage
          console.log('Auth token loaded from native storage');
          // Trigger auth state update if needed
          break;

        default:
          console.log('Unknown native message:', message.type);
      }
    } catch (error) {
      console.error('Error handling native message:', error);
    }
  });

  // Request auth token from native app if available
  if (isNativeApp()) {
    sendToNativeApp({
      type: 'LOAD_TOKEN'
    });
  }
}

/**
 * Send message to native app wrapper
 */
export function sendToNativeApp(message: any) {
  if (typeof window === 'undefined') return;

  try {
    // React Native WebView postMessage
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    } else {
      // Fallback for development
      window.postMessage(message, '*');
    }
  } catch (error) {
    console.error('Error sending message to native app:', error);
  }
}

/**
 * Save auth token to native storage
 */
export function saveAuthTokenNative(token: string) {
  sendToNativeApp({
    type: 'SAVE_TOKEN',
    token: token
  });
}

/**
 * Clear auth token from native storage
 */
export function clearAuthTokenNative() {
  sendToNativeApp({
    type: 'CLEAR_TOKEN'
  });
}
