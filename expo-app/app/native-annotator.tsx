import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { DrawingToolbar } from '../components/skia/DrawingToolbar';
import { useDrawing } from '../hooks/useDrawing';
import { supabase } from '../lib/supabase';
import type { SkiaStroke } from '../components/skia/types';

// Lazy-load native-only modules so the file doesn't crash in Expo Go
let SkiaCanvas: React.ComponentType<any> | null = null;
let Pdf: React.ComponentType<any> | null = null;
try {
  SkiaCanvas = require('../components/skia/SkiaCanvas').SkiaCanvas;
  Pdf = require('react-native-pdf').default;
} catch {
  SkiaCanvas = null;
  Pdf = null;
}

interface PageStrokes {
  [page: number]: SkiaStroke[];
}

export default function NativeAnnotatorScreen() {
  const router = useRouter();
  const { width, height } = Dimensions.get('window');

  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState('Document.pdf');
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileId, setFileId] = useState<string | null>(null);
  const [pageStrokes, setPageStrokes] = useState<PageStrokes>({});

  const drawing = useDrawing();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasWidth = width - 80;
  const canvasHeight = height - 48;

  useEffect(() => { openPicker(); }, []);

  useEffect(() => {
    drawing.loadStrokes(pageStrokes[currentPage] ?? []);
  }, [currentPage]);

  useEffect(() => {
    setPageStrokes(prev => ({ ...prev, [currentPage]: drawing.strokes }));
  }, [drawing.strokes]);

  const openPicker = useCallback(async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) { router.back(); return; }
      const asset = result.assets[0];
      setPdfUri(asset.uri);
      setFileName(asset.name ?? 'Document.pdf');
      setCurrentPage(1);
      setPageStrokes({});
      drawing.loadStrokes([]);
      setFileId(null);
    } catch {
      router.back();
    } finally {
      setPicking(false);
    }
  }, [router]);

  const scheduleSave = useCallback((allPageStrokes: PageStrokes, pages: number, name: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!pdfUri) return;
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const annotations: Record<number, unknown[]> = {};
        for (const [page, strokes] of Object.entries(allPageStrokes)) {
          annotations[Number(page)] = strokes.map(s => ({
            id: s.id,
            type: 'stroke',
            points: s.points,
            style: {
              color: s.color,
              size: s.size,
              opacity: s.opacity,
              compositeOp: s.isHighlighter ? 'multiply' : 'source-over',
            },
          }));
        }
        const annotationCount = Object.values(annotations).reduce((sum, arr) => sum + arr.length, 0);

        if (fileId) {
          await supabase
            .from('annotation_files')
            .update({ annotations, annotation_count: annotationCount, updated_at: new Date().toISOString() })
            .eq('id', fileId);
        } else {
          const { data } = await supabase
            .from('annotation_files')
            .insert({
              user_id: user.id,
              file_name: name,
              file_type: 'pdf',
              page_count: pages,
              annotation_count: annotationCount,
              annotations,
              file_storage_path: null,
              thumbnail: null,
            })
            .select('id')
            .single();
          if (data) setFileId(data.id);
        }
      } catch (err) {
        console.error('Annotation save failed:', err);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [pdfUri, fileId]);

  useEffect(() => {
    if (pdfUri) scheduleSave(pageStrokes, totalPages, fileName);
  }, [pageStrokes]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  if (!SkiaCanvas || !Pdf) {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>Development build required</Text>
        <Text style={styles.unsupportedText}>
          Native PDF annotation requires a dev build —{'\n'}
          <Text style={styles.code}>npx eas build --platform ios --profile development</Text>
        </Text>
        <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (picking || !pdfUri) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0C5E70" />
        <Text style={styles.loadingText}>Choose a PDF…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{fileName}</Text>
        <TouchableOpacity style={styles.openBtn} onPress={openPicker} activeOpacity={0.8}>
          <Text style={styles.openBtnText}>Open PDF</Text>
        </TouchableOpacity>
        {saving && <Text style={styles.savingText}>Saving…</Text>}
      </View>

      <View style={styles.body}>
        <View style={styles.toolbarCol}>
          <DrawingToolbar
            activeTool={drawing.activeTool}
            color={drawing.color}
            size={drawing.size}
            stylusOnly={drawing.stylusOnly}
            background="white"
            canUndo={drawing.canUndo}
            onToolChange={drawing.setTool}
            onColorChange={drawing.setColor}
            onSizeChange={drawing.setSize}
            onStylusOnlyChange={drawing.setStylusOnly}
            onBackgroundChange={() => {}}
            onUndo={drawing.undo}
            onClear={drawing.clear}
          />
        </View>

        <View style={styles.pdfArea}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Pdf
              source={{ uri: pdfUri, cache: true }}
              page={currentPage}
              style={{ flex: 1, backgroundColor: '#fff' }}
              onLoadComplete={(pages: number) => setTotalPages(pages)}
              fitPolicy={0}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              enablePaging={false}
              trustAllCerts={false}
            />
          </View>
          <SkiaCanvas
            width={canvasWidth}
            height={canvasHeight}
            strokes={drawing.strokes}
            activeTool={drawing.activeTool}
            color={drawing.color}
            size={drawing.size}
            stylusOnly={drawing.stylusOnly}
            background="white"
            onStrokeComplete={drawing.addStroke}
            onEraseStroke={drawing.eraseAt}
          />
        </View>
      </View>

      {totalPages > 1 && (
        <View style={styles.pageNav}>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <Text style={styles.pageArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>{currentPage} / {totalPages}</Text>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <Text style={styles.pageArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1F2937' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFB', gap: 16 },
  loadingText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', paddingHorizontal: 16,
    paddingVertical: 8, paddingLeft: 8, gap: 10, height: 48,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 20, color: '#F9FAFB' },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#F9FAFB' },
  openBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#0C5E70', borderRadius: 8 },
  openBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  savingText: { fontSize: 12, color: '#9CA3AF' },
  body: { flex: 1, flexDirection: 'row' },
  toolbarCol: { width: 80, justifyContent: 'center', backgroundColor: '#1F2937' },
  pdfArea: { flex: 1, backgroundColor: '#fff', position: 'relative' },
  pageNav: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    left: '50%', transform: [{ translateX: -60 }],
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 24,
    paddingHorizontal: 8, paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, gap: 6, zIndex: 50,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  pageBtnDisabled: { opacity: 0.3 },
  pageArrow: { fontSize: 24, color: '#374151', lineHeight: 28 },
  pageLabel: { fontSize: 14, fontWeight: '600', color: '#374151', minWidth: 52, textAlign: 'center' },
  unsupported: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8FAFB', padding: 40, gap: 16,
  },
  unsupportedTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  unsupportedText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  code: { fontFamily: 'monospace', color: '#0C5E70' },
  backBtnLarge: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#0C5E70', borderRadius: 12,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
