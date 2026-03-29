import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import type { ToolType, BackgroundType } from './types';
import { COLORS, HIGHLIGHT_COLORS } from './types';

interface DrawingToolbarProps {
  activeTool: ToolType;
  color: string;
  size: number;
  stylusOnly: boolean;
  background: BackgroundType;
  canUndo: boolean;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onStylusOnlyChange: (on: boolean) => void;
  onBackgroundChange: (bg: BackgroundType) => void;
  onUndo: () => void;
  onClear: () => void;
}

const SIZES = [
  { label: 'XS', value: 2 },
  { label: 'S', value: 4 },
  { label: 'M', value: 8 },
  { label: 'L', value: 14 },
  { label: 'XL', value: 22 },
];

const BACKGROUNDS: { type: BackgroundType; label: string; icon: string }[] = [
  { type: 'white', label: 'Blank', icon: '⬜' },
  { type: 'lined', label: 'Lined', icon: '📋' },
  { type: 'graph', label: 'Graph', icon: '#' },
  { type: 'dots', label: 'Dots', icon: '⁝' },
];

function ToolBtn({
  label,
  isActive,
  onPress,
  children,
}: {
  label?: string;
  isActive?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toolBtn, isActive && styles.toolBtnActive]}
      activeOpacity={0.7}
    >
      {children}
      {label && <Text style={[styles.toolBtnLabel, isActive && styles.toolBtnLabelActive]}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function DrawingToolbar({
  activeTool,
  color,
  size,
  stylusOnly,
  background,
  canUndo,
  onToolChange,
  onColorChange,
  onSizeChange,
  onStylusOnlyChange,
  onBackgroundChange,
  onUndo,
  onClear,
}: DrawingToolbarProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);

  const isHighlighter = activeTool === 'highlighter';
  const currentColors = isHighlighter ? HIGHLIGHT_COLORS : COLORS;

  return (
    <>
      <View style={styles.toolbar}>
        {/* Drawing tools */}
        <ToolBtn
          isActive={activeTool === 'pen'}
          onPress={() => onToolChange('pen')}
        >
          <Text style={styles.icon}>✏️</Text>
        </ToolBtn>

        <ToolBtn
          isActive={activeTool === 'highlighter'}
          onPress={() => onToolChange('highlighter')}
        >
          <Text style={styles.icon}>🖊</Text>
        </ToolBtn>

        <ToolBtn
          isActive={activeTool === 'eraser'}
          onPress={() => onToolChange('eraser')}
        >
          <Text style={styles.icon}>⬜</Text>
        </ToolBtn>

        <View style={styles.divider} />

        {/* Color picker trigger */}
        <TouchableOpacity
          onPress={() => setColorPickerOpen(true)}
          style={styles.colorSwatch}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.colorDot,
              {
                backgroundColor: color,
                opacity: isHighlighter ? 0.5 : 1,
              },
            ]}
          />
        </TouchableOpacity>

        {/* Size picker trigger */}
        <ToolBtn onPress={() => setSizePickerOpen(true)}>
          <View style={styles.sizeDotContainer}>
            <View
              style={[
                styles.sizeDot,
                { width: Math.min(size, 22), height: Math.min(size, 22), backgroundColor: '#374151' },
              ]}
            />
          </View>
        </ToolBtn>

        <View style={styles.divider} />

        {/* Background */}
        <ToolBtn onPress={() => setBgPickerOpen(true)}>
          <Text style={styles.icon}>{BACKGROUNDS.find(b => b.type === background)?.icon ?? '#'}</Text>
        </ToolBtn>

        <View style={styles.divider} />

        {/* Palm rejection */}
        <ToolBtn
          isActive={stylusOnly}
          onPress={() => onStylusOnlyChange(!stylusOnly)}
        >
          <Text style={styles.icon}>🖋</Text>
        </ToolBtn>

        <View style={styles.divider} />

        {/* Undo */}
        <ToolBtn onPress={onUndo}>
          <Text style={[styles.icon, !canUndo && { opacity: 0.3 }]}>↩️</Text>
        </ToolBtn>

        {/* Clear */}
        <ToolBtn onPress={onClear}>
          <Text style={styles.icon}>🗑</Text>
        </ToolBtn>
      </View>

      {/* Color picker modal */}
      <Modal visible={colorPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setColorPickerOpen(false)}>
          <View style={styles.colorModal}>
            <Text style={styles.modalTitle}>{isHighlighter ? 'Highlight Color' : 'Pen Color'}</Text>
            <View style={styles.colorGrid}>
              {currentColors.map(c => (
                <TouchableOpacity
                  key={c.hex}
                  onPress={() => { onColorChange(c.hex); setColorPickerOpen(false); }}
                  style={[
                    styles.colorOption,
                    { backgroundColor: c.hex, opacity: isHighlighter ? 0.6 : 1 },
                    color === c.hex && styles.colorOptionSelected,
                  ]}
                />
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Size picker modal */}
      <Modal visible={sizePickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSizePickerOpen(false)}>
          <View style={styles.sizeModal}>
            <Text style={styles.modalTitle}>Stroke Size</Text>
            {SIZES.map(s => (
              <TouchableOpacity
                key={s.value}
                onPress={() => { onSizeChange(s.value); setSizePickerOpen(false); }}
                style={[styles.sizeRow, size === s.value && styles.sizeRowActive]}
              >
                <Text style={styles.sizeLabelText}>{s.label}</Text>
                <View style={styles.sizePreviewTrack}>
                  <View
                    style={[
                      styles.sizePreviewDot,
                      {
                        width: s.value,
                        height: s.value,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Background picker modal */}
      <Modal visible={bgPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setBgPickerOpen(false)}>
          <View style={styles.bgModal}>
            <Text style={styles.modalTitle}>Background</Text>
            <View style={styles.bgGrid}>
              {BACKGROUNDS.map(b => (
                <TouchableOpacity
                  key={b.type}
                  onPress={() => { onBackgroundChange(b.type); setBgPickerOpen(false); }}
                  style={[styles.bgOption, background === b.type && styles.bgOptionSelected]}
                >
                  <Text style={styles.bgIcon}>{b.icon}</Text>
                  <Text style={styles.bgLabel}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    gap: 4,
    zIndex: 100,
    // vertical center
    justifyContent: 'center',
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnActive: {
    backgroundColor: '#E8F5F7',
  },
  toolBtnLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 1,
  },
  toolBtnLabelActive: {
    color: '#0C5E70',
  },
  icon: {
    fontSize: 22,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sizeDotContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeDot: {
    borderRadius: 99,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  colorModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#0C5E70',
  },
  sizeModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    gap: 6,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 12,
  },
  sizeRowActive: {
    backgroundColor: '#E8F5F7',
  },
  sizeLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    width: 24,
  },
  sizePreviewTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  sizePreviewDot: {
    borderRadius: 99,
  },
  bgModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  bgGrid: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  bgOption: {
    width: 54,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 4,
  },
  bgOptionSelected: {
    borderColor: '#0C5E70',
    backgroundColor: '#E8F5F7',
  },
  bgIcon: {
    fontSize: 20,
  },
  bgLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
});
