import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import { SkiaCanvas } from './SkiaCanvas';
import { DrawingToolbar } from './DrawingToolbar';
import { useDrawing } from '../../hooks/useDrawing';

interface SkiaPDFAnnotatorProps {
  pdfUri: string;
  fileName: string;
}

export function SkiaPDFAnnotator({ pdfUri, fileName }: SkiaPDFAnnotatorProps) {
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfSize, setPdfSize] = useState({ width: 0, height: 0 });
  const pdfRef = useRef<any>(null);

  const drawing = useDrawing();
  const screenDims = Dimensions.get('window');

  return (
    <View style={styles.container}>
      {/* PDF layer */}
      <View style={styles.pdfContainer} pointerEvents="none">
        <Pdf
          ref={pdfRef}
          source={{ uri: pdfUri, cache: true }}
          page={currentPage}
          horizontal={false}
          fitPolicy={0} // fit width
          style={[styles.pdf, { width: screenDims.width - 84, height: screenDims.height }]}
          onLoadComplete={(pages, path, size) => {
            setTotalPages(pages);
            setPdfSize({ width: size?.width ?? screenDims.width - 84, height: size?.height ?? screenDims.height });
          }}
          onPageChanged={(page) => setCurrentPage(page)}
          enablePaging={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          trustAllCerts={false}
        />
      </View>

      {/* Annotation canvas overlay */}
      {pdfSize.width > 0 && (
        <View style={[StyleSheet.absoluteFill, { left: 84 }]}>
          <SkiaCanvas
            width={screenDims.width - 84}
            height={screenDims.height}
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
      )}

      {/* Toolbar */}
      <View style={styles.toolbarWrapper}>
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

      {/* Page navigator */}
      {totalPages > 1 && (
        <View style={styles.pageNav}>
          <TouchableOpacity
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            onPress={() => {
              if (currentPage > 1) setCurrentPage(p => p - 1);
            }}
            disabled={currentPage <= 1}
          >
            <Text style={styles.pageArrow}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.pageLabel}>{currentPage} / {totalPages}</Text>

          <TouchableOpacity
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            onPress={() => {
              if (currentPage < totalPages) setCurrentPage(p => p + 1);
            }}
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
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  pdfContainer: {
    position: 'absolute',
    left: 84,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
  },
  pdf: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbarWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 84,
    justifyContent: 'center',
  },
  pageNav: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: [{ translateX: -70 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    gap: 8,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageArrow: {
    fontSize: 24,
    color: '#374151',
    lineHeight: 28,
  },
  pageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    minWidth: 60,
    textAlign: 'center',
  },
});
