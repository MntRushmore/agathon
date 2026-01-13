# Expo iPad App Setup Guide

## Overview

Converting the AI Whiteboard web app to a native iPad app using Expo. This will provide:
- Native iOS experience with better performance
- Offline support with local storage
- Apple Pencil pressure sensitivity
- Home screen installation
- Native gestures and haptics

---

## Architecture Decision

### Option 1: Expo Web View (Fastest - Recommended for MVP)
**Pros:**
- Reuse 100% of existing web app code
- Deploy in 1-2 hours
- Easy to maintain (one codebase)
- All existing features work immediately

**Cons:**
- Not truly native
- Some performance overhead
- Limited native API access

### Option 2: Full React Native Rewrite
**Pros:**
- True native performance
- Full native API access
- Better user experience

**Cons:**
- 2-3 weeks of work
- Need to rewrite TLDraw integration
- Separate codebase to maintain

**Decision: Start with Option 1 (Web View), migrate to Option 2 later**

---

## Quick Start - Expo Web View Approach

### 1. Install Expo CLI

```bash
npm install -g expo-cli eas-cli
```

### 2. Create Expo Project Structure

```bash
# Create expo directory
mkdir expo-app
cd expo-app

# Initialize Expo project
npx create-expo-app@latest . --template blank-typescript

# Install dependencies
npm install expo-web-browser expo-linking expo-constants
npm install @react-native-async-storage/async-storage
npm install react-native-webview
```

### 3. Project Structure

```
madhacks/
├── src/                    # Existing Next.js web app
├── expo-app/              # New Expo iPad app
│   ├── app/
│   │   ├── index.tsx      # Main app entry
│   │   └── _layout.tsx    # Root layout
│   ├── components/
│   │   └── WebViewWrapper.tsx
│   ├── app.json           # Expo configuration
│   ├── package.json
│   └── tsconfig.json
└── package.json           # Root package.json
```

---

## Implementation Steps

### Step 1: Configure app.json

```json
{
  "expo": {
    "name": "AI Whiteboard",
    "slug": "ai-whiteboard",
    "version": "1.0.0",
    "orientation": "landscape",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.aiwhiteboard",
      "buildNumber": "1.0.0",
      "infoPlist": {
        "UISupportsDocumentBrowser": true,
        "NSApplePencilEnabled": true
      }
    },
    "plugins": [
      "expo-router"
    ],
    "scheme": "aiwhiteboard"
  }
}
```

### Step 2: Create WebView Wrapper

**File: `expo-app/components/WebViewWrapper.tsx`**

```typescript
import React, { useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEB_APP_URL = __DEV__
  ? 'http://localhost:3000'  // Development
  : 'https://your-app.vercel.app'; // Production

export default function WebViewWrapper() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // Handle authentication cookies
  const injectedJavaScript = `
    (function() {
      // Detect Apple Pencil
      window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'pen') {
          window.postMessage({
            type: 'APPLE_PENCIL_DETECTED',
            pressure: e.pressure
          });
        }
      });

      // Send device info
      window.postMessage({
        type: 'DEVICE_INFO',
        isNativeApp: true,
        platform: 'ios'
      });
    })();
  `;

  const handleMessage = async (event: any) => {
    const message = JSON.parse(event.nativeEvent.data);

    switch (message.type) {
      case 'APPLE_PENCIL_DETECTED':
        console.log('Apple Pencil pressure:', message.pressure);
        break;
      case 'SAVE_TOKEN':
        await AsyncStorage.setItem('auth_token', message.token);
        break;
    }
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
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
});
```

### Step 3: Create App Entry Point

**File: `expo-app/app/index.tsx`**

```typescript
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WebViewWrapper from '../components/WebViewWrapper';

export default function App() {
  return (
    <SafeAreaProvider>
      <WebViewWrapper />
    </SafeAreaProvider>
  );
}
```

### Step 4: Update Web App for Native Detection

**File: `src/lib/platform.ts`** (New)

```typescript
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && (window as any).__NATIVE_APP__ === true;
}

export function setupNativeAppBridge() {
  if (typeof window === 'undefined') return;

  window.addEventListener('message', (event) => {
    try {
      const message = event.data;

      if (message.type === 'DEVICE_INFO') {
        (window as any).__NATIVE_APP__ = message.isNativeApp;
        (window as any).__PLATFORM__ = message.platform;

        // Enable native-specific features
        document.body.classList.add('native-app');
      }
    } catch (error) {
      console.error('Error handling native message:', error);
    }
  });
}
```

**Add to `src/app/layout.tsx`:**

```typescript
import { setupNativeAppBridge } from '@/lib/platform';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setupNativeAppBridge();
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## Development Workflow

### 1. Start Next.js Dev Server

```bash
# Terminal 1 - Web app
npm run dev
# Runs on http://localhost:3000
```

### 2. Start Expo Dev Server

```bash
# Terminal 2 - Expo app
cd expo-app
npx expo start

# Options:
# - Press 'i' to open iOS simulator
# - Scan QR code with Expo Go app on physical iPad
```

### 3. Test on Physical iPad

```bash
# Install Expo Go from App Store
# Scan QR code from terminal
# App loads your local web app in native wrapper
```

---

## Building for TestFlight

### 1. Configure EAS Build

```bash
cd expo-app
eas build:configure
```

**File: `expo-app/eas.json`**

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "simulator": false
      }
    }
  }
}
```

### 2. Build for TestFlight

```bash
# Login to Expo
eas login

# Build for iOS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

---

## Native Features to Add

### 1. Apple Pencil Pressure Sensitivity

```typescript
// In WebView injected JavaScript
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'pen') {
    // Send pressure data to TLDraw
    window.dispatchEvent(new CustomEvent('pencil-pressure', {
      detail: {
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY
      }
    }));
  }
});
```

### 2. Offline Support

```typescript
import NetInfo from '@react-native-community/netinfo';

// Detect offline mode
NetInfo.addEventListener(state => {
  if (!state.isConnected) {
    // Show offline banner
    // Load cached boards from AsyncStorage
  }
});
```

### 3. Native Share Sheet

```typescript
import * as Sharing from 'expo-sharing';

async function shareBoard(boardId: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(`https://app.com/board/${boardId}`);
  }
}
```

---

## Optimization Checklist

### Performance
- [ ] Enable web view caching
- [ ] Implement offline board storage
- [ ] Optimize image loading
- [ ] Use native navigation for heavy routes

### Apple Pencil
- [ ] Pressure sensitivity working
- [ ] Tilt detection enabled
- [ ] Double-tap gesture support
- [ ] Palm rejection active

### iPad-Specific
- [ ] Landscape orientation enforced
- [ ] Split-view multitasking support
- [ ] Keyboard shortcuts (CMD+S, etc.)
- [ ] Safe area insets respected

### Deployment
- [ ] Production web app URL configured
- [ ] App Store assets ready (icon, screenshots)
- [ ] TestFlight build uploaded
- [ ] Beta testers invited

---

## File Checklist

### New Files to Create
- [ ] `expo-app/app.json` - Expo configuration
- [ ] `expo-app/app/index.tsx` - App entry point
- [ ] `expo-app/components/WebViewWrapper.tsx` - WebView wrapper
- [ ] `expo-app/eas.json` - Build configuration
- [ ] `src/lib/platform.ts` - Native detection utilities

### Assets Needed
- [ ] `expo-app/assets/icon.png` (1024x1024)
- [ ] `expo-app/assets/splash.png` (2048x2732)
- [ ] `expo-app/assets/adaptive-icon.png` (1024x1024)

---

## Timeline

### Phase 1: Basic Setup (2-3 hours)
- Install Expo and dependencies
- Create WebView wrapper
- Test on simulator
- Configure app.json

### Phase 2: Native Features (4-6 hours)
- Apple Pencil integration
- Offline support
- Native share sheet
- Push notifications setup

### Phase 3: Testing & Polish (2-3 hours)
- Test on physical iPad
- Fix landscape mode issues
- Performance optimization
- Beta testing with users

### Phase 4: App Store Deployment (1-2 hours)
- Create App Store Connect listing
- Upload screenshots
- Submit for review
- Launch to TestFlight

**Total: 10-15 hours to production-ready iPad app**

---

## Cost Estimate

- **Expo Account**: Free (for basic features)
- **EAS Build**: $29/month (or free with limited builds)
- **Apple Developer Account**: $99/year (required)
- **Hosting**: $0 (using existing Vercel deployment)

**Total Monthly: ~$30** (after initial $99 Apple fee)

---

## Next Steps

1. Run `npm install -g expo-cli eas-cli`
2. Create `expo-app` directory structure
3. Copy configuration files from this guide
4. Test in iOS simulator
5. Deploy to TestFlight
6. Invite beta testers

Ready to start? Let me know and I'll begin creating the Expo project structure!
