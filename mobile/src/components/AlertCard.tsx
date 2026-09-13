import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown, Info, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Chip, levelTone } from './ui/Chip';
import { color, palette, radii } from '@/constants/theme';
import type { Alert } from '@/api/types';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onCompleteCare?: (alert: Alert) => void;
  onOpenLot?: (batchId: string) => void;
  showWhy?: boolean;
}

export function AlertCard({ alert, onAcknowledge, onCompleteCare, onOpenLot, showWhy = true }: AlertCardProps) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(alert.status === 'ACQUITTEE');
  const acknowledged = ack || alert.status === 'ACQUITTEE';
  const isRed = alert.level === 'ROUGE';
  const isCare = alert.id.startsWith('care:');

  const acknowledge = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAck(true);
    onAcknowledge?.(alert.id);
  };

  const completeCare = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setAck(true);
    onCompleteCare?.(alert);
  };

  return (
    <Card tone={isRed ? 'alert' : alert.level === 'JAUNE' ? 'warn' : 'green'} padding={false} style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.top}>
          <Chip label={alert.kind} tone={levelTone(alert.level)} dot />
          {alert.batchName ? (
            <AppText size="small" weight="medium" color="muted">
              {alert.batchName}
            </AppText>
          ) : null}
        </View>

        <AppText size="body" weight="semibold" style={styles.message}>
          {alert.message}
        </AppText>

        {alert.recommendation ? (
          <View style={styles.reco}>
            <Zap size={14} color={color.accent[600]} />
            <AppText size="bodyM" color="ink" style={{ flex: 1 }}>
              {alert.recommendation}
            </AppText>
          </View>
        ) : null}

        {!acknowledged && (
          <View style={styles.actionsRow}>
            {isCare && onCompleteCare ? (
              <Button
                label="Fait"
                tone="success"
                size="md"
                block={false}
                icon={Check}
                onPress={completeCare}
              />
            ) : (
              <Button
                label="Reconnu"
                tone={isRed ? 'danger' : 'success'}
                size="md"
                block={false}
                icon={Check}
                onPress={acknowledge}
              />
            )}
            {alert.batchId && onOpenLot ? (
              <Button
                label="Voir le lot"
                tone="ghost"
                size="md"
                block={false}
                onPress={() => onOpenLot(alert.batchId!)}
              />
            ) : null}
          </View>
        )}

        {showWhy && alert.why.length > 0 && (
          <Pressable onPress={() => setOpen((o) => !o)} style={styles.whyToggle} accessibilityRole="button">
            <Info size={13} color={palette.ink[400]} />
            <AppText size="small" weight="semibold" color="muted">
              Pourquoi KouKou dit ça ?
            </AppText>
            <View style={open && styles.rotated}>
              <ChevronDown size={15} color={palette.ink[400]} />
            </View>
          </Pressable>
        )}

        {open &&
          alert.why.map((line, i) => (
            <View key={i} style={styles.whyLine}>
              <View style={styles.whyBullet} />
              <AppText size="caption" color="muted" style={{ flex: 1 }}>
                {line}
              </AppText>
            </View>
          ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
  },
  inner: {
    padding: 14,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  message: {
    color: color.ink[900],
  },
  reco: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: color.accent[50],
    borderRadius: radii.sm,
    padding: 9,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  whyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  rotated: {
    transform: [{ rotate: '180deg' }],
  },
  whyLine: {
    flexDirection: 'row',
    gap: 7,
  },
  whyBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.ink[300],
    marginTop: 6,
  },
});
