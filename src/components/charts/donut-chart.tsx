import { useColorScheme } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { ChartColors, DONUT_PALETTE } from '@/constants/theme';

// RN-SVG port of Inventra/components/charts/DonutChart.tsx — same ring-
// segment math (stroke-dasharray/dashoffset trick on a plain <circle>),
// rebuilt with react-native-svg's Circle instead of a raw SVG string.
export function DonutChart({ data, totalLabel }: { data: { name: string; pct: number }[]; totalLabel: string }) {
  const scheme = useColorScheme();
  const colors = ChartColors[scheme === 'dark' ? 'dark' : 'light'];

  const cx = 65;
  const cy = 65;
  const r = 48;
  const sw = 18;
  const C = 2 * Math.PI * r;

  // Cumulative offsets computed as a pure scan (no render-time mutation) —
  // each segment's dash-offset is the running total of every prior
  // segment's arc length.
  const segments = data.reduce<{ len: number; offset: number }[]>((acc, d) => {
    const len = C * (Math.max(d.pct, 0) / 100);
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
    return [...acc, { len, offset: prevOffset }];
  }, []);

  const arcs = data.map((d, i) => (
    <Circle
      key={d.name}
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={DONUT_PALETTE[i % DONUT_PALETTE.length]}
      strokeWidth={sw}
      strokeDasharray={`${segments[i].len.toFixed(2)} ${(C - segments[i].len).toFixed(2)}`}
      strokeDashoffset={-segments[i].offset}
      strokeLinecap="butt"
      transform={`rotate(-90 ${cx} ${cy})`}
    />
  ));

  return (
    <Svg width={130} height={130} viewBox="0 0 130 130">
      {arcs}
      <SvgText x={65} y={61} textAnchor="middle" fontSize={15} fontWeight="700" fill={colors.text}>
        {totalLabel}
      </SvgText>
      <SvgText x={65} y={78} textAnchor="middle" fontSize={10.5} fill={colors.muted}>
        total value
      </SvgText>
    </Svg>
  );
}
