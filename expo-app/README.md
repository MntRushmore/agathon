# AI Whiteboard - iPad App (Expo)

Native iPad wrapper for the AI Whiteboard web app using Expo and React Native WebView.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Web App

First, make sure the Next.js web app is running:

```bash
# In the root directory
cd ..
npm run dev
```

The web app should be running at `http://localhost:3000`

### 3. Run the Expo App

```bash
# Start Expo dev server
npx expo start

# Then:
# - Press 'i' to open iOS Simulator
# - Scan QR code with Expo Go app on physical iPad
```

## Development

### Testing on iOS Simulator

```bash
npx expo start --ios
```

### Testing on Physical iPad

1. Install "Expo Go" from the App Store
2. Make sure your iPad and computer are on the same network
3. Run `npx expo start`
4. Scan the QR code with Expo Go app

### Local Network Setup

For the iPad to access your local Next.js dev server:

1. Find your computer's local IP address:
   - macOS: System Preferences → Network
   - Usually looks like: `192.168.1.XXX`

2. Update `WebViewWrapper.tsx`:
   ```typescript
   const WEB_APP_URL = __DEV__
     ? 'http://192.168.1.XXX:3000'  // Replace with your IP
     : 'https://your-app.vercel.app';
   ```

3. Make sure your Next.js dev server is accessible:
   ```bash
   # In root directory
   npm run dev -- -H 0.0.0.0
   ```

## Features

### Implemented ✅
- WebView wrapper with web app integration
- Apple Pencil detection
- Native-specific optimizations
- Landscape orientation for iPad
- Auth token storage in native AsyncStorage
- Message bridge between web and native

### Native Features
- **Apple Pencil**: Pressure sensitivity detected and sent to web app
- **Native Storage**: Auth tokens stored securely in AsyncStorage
- **Landscape Mode**: Forced landscape orientation for optimal drawing
- **iOS Safe Areas**: Respects notch and home indicator
- **Native Gestures**: Back/forward navigation gestures

## Building for Production

### Build with EAS

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo:
   ```bash
   eas login
   ```

3. Configure EAS:
   ```bash
   eas build:configure
   ```

4. Build for iOS:
   ```bash
   eas build --platform ios --profile production
   ```

5. Submit to TestFlight:
   ```bash
   eas submit --platform ios
   ```

### Update Production URL

Before building, update the production URL in `components/WebViewWrapper.tsx`:

```typescript
const WEB_APP_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-actual-app.vercel.app'; // Update this!
```

## Project Structure

```
expo-app/
├── App.tsx                      # Main app entry
├── app.json                     # Expo configuration
├── components/
│   └── WebViewWrapper.tsx       # WebView wrapper component
├── assets/                      # App icons and splash screens
└── package.json
```

## Configuration

### app.json

Key settings:
- `orientation`: "landscape" (iPad optimized)
- `ios.supportsTablet`: true (iPad support)
- `ios.bundleIdentifier`: "com.aiwhiteboard.app"
- `ios.infoPlist.NSApplePencilEnabled`: true (Apple Pencil)

### WebView Settings

In `WebViewWrapper.tsx`:
- `javaScriptEnabled`: true
- `domStorageEnabled`: true (for localStorage)
- `sharedCookiesEnabled`: true (for auth cookies)
- `allowsInlineMediaPlayback`: true (for voice mode)
- `bounces`: false (disable rubber band scrolling)

## Troubleshooting

### Web app not loading

1. Check that Next.js dev server is running
2. Verify the URL is correct (use your local IP, not localhost)
3. Make sure firewall allows connections on port 3000
4. Try accessing the URL in Safari on your iPad

### Apple Pencil not detected

1. Check console logs in Expo for "Apple Pencil detected" messages
2. Verify `NSApplePencilEnabled` is set in app.json
3. Make sure you're testing on a physical iPad (simulator doesn't support)

### Auth not persisting

1. Check AsyncStorage is saving tokens (see console logs)
2. Verify `sharedCookiesEnabled` is true in WebView
3. Make sure web app is sending SAVE_TOKEN messages

### Build errors

1. Make sure all dependencies are installed: `npm install`
2. Clear cache: `npx expo start --clear`
3. Check that bundle identifier is unique in app.json

## Performance Tips

1. **Enable caching**: `cacheEnabled: true` in WebView
2. **Optimize images**: Use WebP format in web app
3. **Minimize bundle**: Use code splitting in Next.js
4. **Native navigation**: Consider react-navigation for heavy screens

## Deployment Checklist

- [ ] Update production URL in WebViewWrapper.tsx
- [ ] Test on physical iPad
- [ ] Verify Apple Pencil works
- [ ] Test landscape orientation
- [ ] Check auth flow (login/logout)
- [ ] Test board sharing
- [ ] Verify live collaboration works
- [ ] Create app icons (1024x1024)
- [ ] Create splash screen
- [ ] Build with EAS
- [ ] Submit to TestFlight
- [ ] Invite beta testers

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [iOS App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Support

For issues or questions:
1. Check Expo logs: `npx expo start`
2. Check Next.js logs in terminal
3. Check browser console in WebView (use Safari dev tools)
4. Review [EXPO_SETUP.md](../EXPO_SETUP.md) in root directory
