import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

// Development: Use localhost for simulator, IP for physical device
// Production: Use your deployed Vercel URL
const WEB_APP_URL = __DEV__
  ? 'http://localhost:3000'  // Use localhost for iOS Simulator
  : 'https://your-app.vercel.app'; // Replace with your production URL

export default function WebViewWrapper() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // JavaScript to inject into the web page
  const injectedJavaScript = `
    (function() {
      // Detect Apple Pencil and send pressure data
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'pen') {
          window.postMessage(JSON.stringify({
            type: 'APPLE_PENCIL_DETECTED',
            pressure: e.pressure,
            tiltX: e.tiltX,
            tiltY: e.tiltY
          }));
        }
      });

      // Send device info to web app
      window.postMessage(JSON.stringify({
        type: 'DEVICE_INFO',
        isNativeApp: true,
        platform: 'ios',
        isIpad: true
      }));

      // Mark the window as native app for detection
      window.__NATIVE_APP__ = true;
      window.__PLATFORM__ = 'ios';

      console.log('Native app bridge initialized');
    })();
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
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        bounces={false}
        scrollEnabled={true}
        // Allow file uploads (for image selection)
        allowFileAccess={true}
        // Disable zoom
        scalesPageToFit={false}
        // Performance optimizations
        cacheEnabled={true}
        incognito={false}
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
