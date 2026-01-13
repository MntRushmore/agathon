import React from 'react';
import { StatusBar } from 'expo-status-bar';
import WebViewWrapper from './components/WebViewWrapper';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <WebViewWrapper />
    </>
  );
}
