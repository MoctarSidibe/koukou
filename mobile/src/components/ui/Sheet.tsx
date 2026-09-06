import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

import { AppText } from './AppText';
import { color, palette, layout, radii, shadow } from '@/constants/theme';

interface SheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const MAX_H = 0.92;

export function Sheet({ visible, title, subtitle, icon, accentColor, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!visible) return;
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, accentColor && styles.sheetAccent, accentColor && { borderTopColor: accentColor }]}>
          <View style={[styles.handle, accentColor && { backgroundColor: accentColor }]} />
          {(title || icon) && (
            <View style={styles.header}>
              <View style={styles.titleWrap}>
                {icon}
                <View style={{ flex: 1 }}>
                  <AppText size="h3" weight="bold" numberOfLines={1}>
                    {title}
                  </AppText>
                  {subtitle ? (
                    <AppText size="caption" color="muted" numberOfLines={1}>
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
                <X size={20} color={color.ink[600]} />
              </Pressable>
            </View>
          )}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 35, 49, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: layout.maxW,
    backgroundColor: palette.paper,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    maxHeight: `${MAX_H * 100}%`,
    paddingHorizontal: layout.contentPadding,
    paddingBottom: 28,
    paddingTop: 14,
    ...shadow.fab,
  },
  sheetAccent: {
    borderTopWidth: 4,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.border,
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 12,
  },
});
