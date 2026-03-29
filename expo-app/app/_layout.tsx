import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="native-board" options={{ headerShown: false }} />
        <Stack.Screen name="native-annotator" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
