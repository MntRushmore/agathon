import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DrawingToolbar } from '../components/skia/DrawingToolbar';
import { useDrawing } from '../hooks/useDrawing';
import { supabase } from '../lib/supabase';
import type { SkiaStroke } from '../components/skia/types';

// Lazy-load native modules so the file doesn't crash in Expo Go
let SkiaCanvas: React.ComponentType<any> | null = null;
try {
  SkiaCanvas = require('../components/skia/SkiaCanvas').SkiaCanvas;
} catch {
  SkiaCanvas = null;
}

const NATIVE_STROKES_KEY = 'nativeStrokes';

export default function NativeBoardScreen() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const router = useRouter();
  const drawing = useDrawing();
  const { width, height } = Dimensions.get('window');

  const [boardTitle, setBoardTitle] = useState('Whiteboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasWidth = width - 80;
  const canvasHeight = height;

  useEffect(() => {
    if (!boardId) { setLoading(false); return; }
    supabase
      .from('whiteboards')
      .select('title, metadata')
      .eq('id', boardId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        setBoardTitle(data.title ?? 'Whiteboard');
        const meta = data.metadata as Record<string, unknown> | null;
        const saved = meta?.[NATIVE_STROKES_KEY];
        if (Array.isArray(saved) && saved.length > 0) {
          drawing.loadStrokes(saved as SkiaStroke[]);
        }
        setLoading(false);
      });
  }, [boardId]);

  const scheduleSave = useCallback((strokes: SkiaStroke[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!boardId) return;
      setSaving(true);
      try {
        const { data: current } = await supabase
          .from('whiteboards')
          .select('metadata')
          .eq('id', boardId)
          .single();
        const existingMeta = (current?.metadata as Record<string, unknown>) ?? {};
        await supabase
          .from('whiteboards')
          .update({
            metadata: { ...existingMeta, [NATIVE_STROKES_KEY]: strokes },
            updated_at: new Date().toISOString(),
          })
          .eq('id', boardId);
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [boardId]);

  useEffect(() => {
    if (!loading) scheduleSave(drawing.strokes);
  }, [drawing.strokes, loading]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (!SkiaCanvas) {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>Development build required</Text>
        <Text style={styles.unsupportedText}>
          Native drawing requires a dev build — run{'\n'}
          <Text style={styles.code}>npx eas build --platform ios --profile development</Text>
        </Text>
        <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0C5E70" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.canvasArea, { width: canvasWidth, height: canvasHeight }]}>
        <SkiaCanvas
          width={canvasWidth}
          height={canvasHeight}
          strokes={drawing.strokes}
          activeTool={drawing.activeTool}
          color={drawing.color}
          size={drawing.size}
          stylusOnly={drawing.stylusOnly}
          background={drawing.background}
          onStrokeComplete={drawing.addStroke}
          onEraseStroke={drawing.eraseAt}
        />
      </View>

      <View style={styles.toolbarCol}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <DrawingToolbar
          activeTool={drawing.activeTool}
          color={drawing.color}
          size={drawing.size}
          stylusOnly={drawing.stylusOnly}
          background={drawing.background}
          canUndo={drawing.canUndo}
          onToolChange={drawing.setTool}
          onColorChange={drawing.setColor}
          onSizeChange={drawing.setSize}
          onStylusOnlyChange={drawing.setStylusOnly}
          onBackgroundChange={drawing.setBackground}
          onUndo={drawing.undo}
          onClear={drawing.clear}
        />
      </View>

      <View style={styles.titleBar} pointerEvents="none">
        <Text style={styles.boardTitle} numberOfLines={1}>{boardTitle}</Text>
        {saving && <Text style={styles.savingText}>Saving…</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  canvasArea: { position: 'absolute', left: 80, top: 0 },
  toolbarCol: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 80,
    alignItems: 'center', paddingTop: 16, zIndex: 10,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  backIcon: { fontSize: 20, color: '#374151' },
  titleBar: {
    position: 'absolute', top: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  boardTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(55,65,81,0.7)', maxWidth: 260 },
  savingText: { fontSize: 12, color: '#9CA3AF' },
  unsupported: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8FAFB', padding: 40, gap: 16,
  },
  unsupportedTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  unsupportedText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  code: { fontFamily: 'monospace', backgroundColor: '#F3F4F6', color: '#0C5E70' },
  backBtnLarge: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#0C5E70', borderRadius: 12,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
