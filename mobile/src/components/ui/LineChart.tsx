import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Circle, Line, Polyline, Svg, Text as SvgText } from 'react-native-svg';

import { AppText } from './AppText';
import { color, palette } from '@/constants/theme';

interface LineChartProps {
  points: { x: string; y: number | null }[];
  height?: number;
  stroke: string;
  referencePoints?: { x: string; y: number }[];
  unit?: string;
  format?: (v: number) => string;
}

const W = 320;
const PAD_L = 36;
const PAD_R = 10;
const PAD_B = 22;
const PAD_T = 12;

function buildPath(values: number[], h: number, min: number, max: number): string {
  const span = Math.max(0.0001, max - min);
  const denom = Math.max(1, values.length - 1);
  const sx = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / denom;
  const sy = (v: number) => PAD_T + (1 - (v - min) / span) * (h - PAD_T - PAD_B);
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
}

export function LineChart({
  points,
  height = 150,
  stroke,
  referencePoints,
  unit,
  format = (v) => v.toLocaleString('fr-FR'),
}: LineChartProps) {
  const H = height;

  const { min, max, hasNull } = useMemo(() => {
    const ys = points.map((p) => p.y).filter((y): y is number => y != null);
    const refs = referencePoints?.map((p) => p.y) ?? [];
    const all = [...ys, ...refs];
    return { min: Math.min(...all) * 0.97, max: Math.max(...all) * 1.03, hasNull: points.some((p) => p.y == null) };
  }, [points, referencePoints]);

  const mainPath = hasNull
    ? null
    : buildPath(points.map((p) => p.y as number), H, min, max);
  const referencePath = referencePoints
    ? buildPath(referencePoints.map((p) => p.y), H, min, max)
    : null;

  const lastIndex = points.length - 1;
  const lastY =
    !hasNull && points[lastIndex]?.y != null
      ? PAD_T + (1 - ((points[lastIndex].y as number) - min) / Math.max(0.0001, max - min)) * (H - PAD_T - PAD_B)
      : null;
  const lastX = W - PAD_R;

  const gridTicks = 3;
  const ticks = Array.from({ length: gridTicks + 1 }, (_, i) => min + ((max - min) * i) / gridTicks);
  const sy = (v: number) => PAD_T + (1 - (v - min) / Math.max(0.0001, max - min)) * (H - PAD_T - PAD_B);

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={sy(t)}
            y2={sy(t)}
            stroke={color.border}
            strokeWidth={0.8}
            strokeDasharray="3 4"
          />
        ))}
        {ticks.map((t, i) => (
          <SvgText key={`l${i}`} x={0} y={sy(t) + 3} fontSize={9} fill={palette.ink[300]} fontFamily="monospace">
            {format(t)}
          </SvgText>
        ))}
        {referencePath ? (
          <Polyline points={referencePath} fill="none" stroke={color.ink[200]} strokeWidth={2} strokeDasharray="6 5" />
        ) : null}
        {mainPath ? <Polyline points={mainPath} fill="none" stroke={stroke} strokeWidth={3} strokeLinejoin="round" /> : null}
        {lastY != null ? <Circle cx={lastX} cy={lastY} r={4.5} fill={stroke} /> : null}
      </Svg>
      <View style={styles.xLabels}>
        {points.map((p, i) => (
          <AppText
            key={`${p.x}-${i}`}
            size="small"
            color="faint"
            style={{ flex: 1, textAlign: i === 0 ? 'left' : i === points.length - 1 ? 'right' : 'center' }}>
            {p.x}
          </AppText>
        ))}
      </View>
      {unit ? (
        <AppText size="small" color="muted" align="right" style={{ marginTop: 6 }}>
          {unit}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    marginTop: 2,
  },
  unit: {
    marginTop: 6,
    textAlign: 'right',
  },
});
