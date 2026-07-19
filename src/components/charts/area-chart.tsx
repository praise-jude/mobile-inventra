import { useColorScheme } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { ChartColors } from '@/constants/theme';

interface Series {
  key: string;
  color: string;
  values: number[];
}

// RN-SVG port of Inventra/components/charts/AreaChart.tsx — same math
// (X/Y projection, path/area generation, gradient defs, dashed grid,
// every-other-month labels), rebuilt with react-native-svg elements since
// that component injects a raw SVG string via dangerouslySetInnerHTML,
// which has no RN equivalent.
export function AreaChart({
  months,
  series,
  idPrefix = 'ac',
  height = 150,
}: {
  months: string[];
  series: Series[];
  idPrefix?: string;
  height?: number;
}) {
  const scheme = useColorScheme();
  const colors = ChartColors[scheme === 'dark' ? 'dark' : 'light'];

  const w = 560;
  const h = height;
  const pad = 26;
  const bottom = 26;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues) * 1.08;

  const X = (i: number) => pad + (i / Math.max(1, months.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - bottom - (v / max) * (h - bottom - 14);
  const line = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = (arr: number[]) =>
    `${line(arr)} L${X(arr.length - 1).toFixed(1)},${h - bottom} L${X(0).toFixed(1)},${h - bottom} Z`;

  const gridLines = [0, 1, 2, 3].map((g) => 12 + g * ((h - bottom - 12) / 3));

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <Defs>
        {series.map((s) => (
          <LinearGradient key={s.key} id={`${idPrefix}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.color} stopOpacity={0.24} />
            <Stop offset="1" stopColor={s.color} stopOpacity={0} />
          </LinearGradient>
        ))}
      </Defs>

      {gridLines.map((y, i) => (
        <Line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="3 4" />
      ))}

      {series.map((s) => (
        <Path key={`${s.key}-area`} d={area(s.values)} fill={`url(#${idPrefix}-${s.key})`} />
      ))}
      {series.map((s) => (
        <Path key={`${s.key}-line`} d={line(s.values)} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {series.map(
        (s) =>
          s.values.length > 0 && (
            <Circle
              key={`${s.key}-dot`}
              cx={X(s.values.length - 1)}
              cy={Y(s.values[s.values.length - 1])}
              r={3.8}
              fill={s.color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          ),
      )}

      {months.map(
        (m, i) =>
          i % 2 === 0 && (
            <SvgText key={i} x={X(i)} y={h - 8} fill={colors.muted} fontSize={10.5} textAnchor="middle">
              {m}
            </SvgText>
          ),
      )}
    </Svg>
  );
}
