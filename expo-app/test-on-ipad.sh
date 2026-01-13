#!/bin/bash

# Helper script to test the app on iPad
# Makes it easy to get your local IP and update the WebView URL

echo "🎨 AI Whiteboard - iPad Testing Helper"
echo "======================================"
echo ""

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0)
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ipconfig getifaddr en1)
    fi
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local IP address"
    echo "Please find it manually:"
    echo "  macOS: System Preferences → Network"
    echo "  Linux: ip addr show"
    exit 1
fi

echo "✅ Detected local IP: $LOCAL_IP"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Update WebViewWrapper.tsx with your IP:"
echo "   const WEB_APP_URL = __DEV__"
echo "     ? 'http://$LOCAL_IP:3000'"
echo "     : 'https://your-app.vercel.app';"
echo ""
echo "2. Start Next.js dev server (in root directory):"
echo "   npm run dev -- -H 0.0.0.0"
echo ""
echo "3. Start Expo (in expo-app directory):"
echo "   npx expo start"
echo ""
echo "4. Scan QR code with Expo Go app on your iPad"
echo ""
echo "🍏 Don't have Expo Go? Install from App Store:"
echo "   https://apps.apple.com/app/expo-go/id982107779"
echo ""

# Offer to update the file automatically
read -p "Would you like to update WebViewWrapper.tsx automatically? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Update the file
    sed -i.bak "s|http://localhost:3000|http://$LOCAL_IP:3000|g" components/WebViewWrapper.tsx
    echo "✅ Updated WebViewWrapper.tsx with IP: $LOCAL_IP"
    echo "   (Backup saved as WebViewWrapper.tsx.bak)"
else
    echo "Skipped automatic update. Please update manually."
fi

echo ""
echo "Happy testing! 🚀"
