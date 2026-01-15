import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

// Use your production Vercel URL
const WEB_APP_URL = 'https://whiteboard-delta-wine.vercel.app/';

export default function WebViewWrapper() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // JavaScript to inject into the web page - optimized for iPad
  const injectedJavaScript = `
    (function() {
      // Prevent default touch behaviors that interfere with canvas
      document.addEventListener('gesturestart', function(e) {
        e.preventDefault();
      }, { passive: false });

      // Prevent double-tap zoom on iPad
      let lastTouchEnd = 0;
      document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, { passive: false });

      // Prevent pinch zoom on canvas areas
      document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 1) {
          // Allow pinch on tldraw canvas (it handles its own zoom)
          const target = e.target;
          const isTldrawCanvas = target.closest('.tl-canvas') || target.closest('[data-testid="canvas"]');
          if (!isTldrawCanvas) {
            e.preventDefault();
          }
        }
      }, { passive: false });

      // Fix viewport for iPad
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }

      // Detect Apple Pencil and send pressure data
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'pen') {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'APPLE_PENCIL_DETECTED',
            pressure: e.pressure,
            tiltX: e.tiltX,
            tiltY: e.tiltY
          }));
        }
      });

      // Send device info to web app
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const isIPad = Math.min(screenWidth, screenHeight) >= 768;

      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'DEVICE_INFO',
        isNativeApp: true,
        platform: 'ios',
        isIpad: isIPad,
        screenWidth: screenWidth,
        screenHeight: screenHeight
      }));

      // Mark the window as native app for detection
      window.__NATIVE_APP__ = true;
      window.__PLATFORM__ = 'ios';
      window.__IS_IPAD__ = isIPad;

      // Fix for iOS keyboard pushing content
      if (isIPad) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.overflow = 'hidden';
      }

      // Ensure touch-action is set correctly for drawing
      const style = document.createElement('style');
      style.textContent = \`
        .tl-canvas, [data-testid="canvas"] {
          touch-action: none !important;
        }
        body {
          overscroll-behavior: none;
          -webkit-overflow-scrolling: auto;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      \`;
      document.head.appendChild(style);

      console.log('Native app bridge initialized for iPad:', isIPad);
    })();
    true;
  `;

  // Handle messages from the web app
  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'APPLE_PENCIL_DETECTED':
          console.log('Apple Pencil detected - Pressure:', message.pressure);
          break;

        case 'SAVE_TOKEN':
          // Save auth token to native storage
          await AsyncStorage.setItem('auth_token', message.token);
          console.log('Auth token saved');
          break;

        case 'LOAD_TOKEN':
          // Load auth token from native storage
          const token = await AsyncStorage.getItem('auth_token');
          if (token && webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'TOKEN_LOADED',
              token: token
            }));
          }
          break;

        case 'CLEAR_TOKEN':
          // Clear auth token
          await AsyncStorage.removeItem('auth_token');
          console.log('Auth token cleared');
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  // Load auth token on mount
  useEffect(() => {
    async function loadToken() {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          console.log('Auth token loaded from storage');
        }
      } catch (error) {
        console.error('Error loading token:', error);
      }
    }
    loadToken();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading AI Whiteboard...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load app</Text>
          <Text style={styles.errorDetails}>{error}</Text>
          <Text style={styles.errorHint}>
            Make sure the web app is running at: {WEB_APP_URL}
          </Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          setError(null);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || 'Unknown error');
          setLoading(false);
        }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        // Navigation
        allowsBackForwardNavigationGestures={false}
        // Media
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // JavaScript & Storage
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        // Critical for iPad touch/scroll handling
        bounces={false}
        scrollEnabled={false}
        // File access
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        // Viewport & scaling - critical for iPad
        scalesPageToFit={false}
        contentMode="mobile"
        // Performance
        cacheEnabled={true}
        incognito={false}
        // Touch handling - let the web app handle all touch events
        overScrollMode="never"
        nestedScrollEnabled={false}
        // iPad-specific optimizations
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
        automaticallyAdjustsScrollIndicatorInsets={false}
        // Prevent text selection interfering with drawing
        textInteractionEnabled={false}
        // Hardware acceleration
        androidLayerType="hardware"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
