import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://agathon.app';

const EXTERNAL_URL_PATTERNS = [
  'accounts.google.com',
  'github.com/login',
  'appleid.apple.com',
];

const NATIVE_BOARD_PATTERN = /\/board\/([a-zA-Z0-9_-]+)/;
const NATIVE_ANNOTATE_PATTERN = /\/annotate(?:\/|\?|$)/;

export default function WebViewWrapper() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [error, setError] = useState<string | null>(null);
  // Track last intercepted boardId so we don't double-push
  const lastInterceptedRef = useRef<string | null>(null);

  const injectedJavaScript = `
    (function() {
      // Prevent double-tap zoom
      let lastTouchEnd = 0;
      document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) { e.preventDefault(); }
        lastTouchEnd = now;
      }, { passive: false });

      document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
      }, { passive: false });

      // Fix viewport
      const vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');

      // Mark as native app
      window.__NATIVE_APP__ = true;
      window.__PLATFORM__ = 'ios';
      window.__IS_IPAD__ = true;
      document.body.classList.add('native-app', 'platform-ios', 'platform-ipad');

      // Notify native of current URL on every navigation
      function notifyNav(url) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NAVIGATE', url: url }));
        } catch(e) {}
      }

      // Intercept SPA navigation
      const _push = history.pushState.bind(history);
      const _replace = history.replaceState.bind(history);
      history.pushState = function(s, t, url) {
        _push(s, t, url);
        notifyNav(typeof url === 'string' ? url : window.location.href);
      };
      history.replaceState = function(s, t, url) {
        _replace(s, t, url);
        notifyNav(typeof url === 'string' ? url : window.location.href);
      };
      window.addEventListener('popstate', function() {
        notifyNav(window.location.href);
      });

      // Also notify current URL on load
      notifyNav(window.location.href);

      // iOS scroll/overflow fix
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.overflow = 'hidden';

      const style = document.createElement('style');
      style.textContent = '* { -webkit-tap-highlight-color: transparent; } body { overscroll-behavior: none; }';
      document.head.appendChild(style);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEVICE_INFO', isNativeApp: true, platform: 'ios', isIpad: true,
      }));
    })();
    true;
  `;

  const navigateToBoard = useCallback((boardId: string) => {
    if (lastInterceptedRef.current === boardId) return;
    lastInterceptedRef.current = boardId;
    // Small timeout to let the WebView settle before we navigate away
    setTimeout(() => {
      router.push({ pathname: '/native-board', params: { boardId } });
      // Send the WebView back to dashboard
      webViewRef.current?.injectJavaScript('window.history.back(); true;');
      // Reset after a delay so the same board can be re-opened
      setTimeout(() => { lastInterceptedRef.current = null; }, 2000);
    }, 50);
  }, [router]);

  const handleMessage = useCallback(async (event: any) => {
    let message: any;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }

    switch (message.type) {
      case 'NAVIGATE': {
        const url: string = message.url || '';
        const boardMatch = url.match(NATIVE_BOARD_PATTERN);
        if (boardMatch) {
          navigateToBoard(boardMatch[1]);
          return;
        }
        if (NATIVE_ANNOTATE_PATTERN.test(url)) {
          router.push('/native-annotator');
          webViewRef.current?.injectJavaScript('window.history.back(); true;');
          return;
        }
        break;
      }
      case 'SAVE_TOKEN':
        await SecureStore.setItemAsync('auth_token', message.token);
        break;
      case 'LOAD_TOKEN': {
        const token = await SecureStore.getItemAsync('auth_token');
        if (token) {
          webViewRef.current?.injectJavaScript(
            `window.dispatchEvent(new CustomEvent('native-token',{detail:${JSON.stringify({ token })}})); true;`
          );
        }
        break;
      }
      case 'CLEAR_TOKEN':
        await SecureStore.deleteItemAsync('auth_token');
        break;
    }
  }, [navigateToBoard, router]);

  // Handle OAuth deep links
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (url.startsWith('agathon://') || url.includes('/auth/callback')) {
        const callbackUrl = url.replace('agathon://', WEB_APP_URL);
        if (callbackUrl.startsWith('https://')) {
          webViewRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(callbackUrl)}; true;`);
        }
      }
    };
    const sub = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }); });
    return () => sub.remove();
  }, []);

  // onShouldStartLoadWithRequest: catches full-page navigations (hard navigations, not SPA)
  const handleNavigationRequest = useCallback((request: WebViewNavigation): boolean => {
    const { url } = request;

    // Let the initial page load through
    if (url === WEB_APP_URL || url === WEB_APP_URL + '/') return true;

    // External auth URLs
    if (EXTERNAL_URL_PATTERNS.some(p => url.includes(p))) {
      WebBrowser.openBrowserAsync(url, { showInRecents: true, dismissButtonStyle: 'close' })
        .catch(() => Linking.openURL(url));
      return false;
    }

    // Block hard navigation to board pages — handled natively
    const boardMatch = url.match(NATIVE_BOARD_PATTERN);
    if (boardMatch && url.includes('agathon.app')) {
      navigateToBoard(boardMatch[1]);
      return false;
    }

    return true;
  }, [navigateToBoard]);

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Failed to load Agathon</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onError={(e) => setError(e.nativeEvent.description || 'Unknown error')}
        injectedJavaScript={injectedJavaScript}
        injectedJavaScriptBeforeContentLoaded={`
          window.__NATIVE_APP__ = true;
          window.__PLATFORM__ = 'ios';
          window.__IS_IPAD__ = true;
          true;
        `}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        bounces={false}
        scrollEnabled={false}
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        scalesPageToFit={false}
        contentMode="mobile"
        cacheEnabled
        overScrollMode="never"
        nestedScrollEnabled={false}
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        automaticallyAdjustsScrollIndicatorInsets={false}
        textInteractionEnabled={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1, backgroundColor: '#fff' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  errorDetail: { fontSize: 14, color: '#666', textAlign: 'center' },
});
