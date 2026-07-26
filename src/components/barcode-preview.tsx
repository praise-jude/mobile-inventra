import Svg, { Rect } from "react-native-svg";

import { encodeCode128B } from "@/lib/barcode128";

// Mirrors Inventra/components/products/BarcodePreview.tsx's contract
// (render a scannable barcode for a product's barcode/SKU) using
// react-native-svg instead of jsbarcode — see barcode128.ts for why.
export function BarcodePreview({ value, height = 46, unitWidth = 2 }: { value: string | null | undefined; height?: number; unitWidth?: number }) {
  if (!value) return null;
  const widths = encodeCode128B(value);
  if (!widths) return null;

  let x = 0;
  const bars: { x: number; width: number }[] = [];
  widths.forEach((w, i) => {
    const barWidth = w * unitWidth;
    if (i % 2 === 0) bars.push({ x, width: barWidth });
    x += barWidth;
  });

  return (
    <Svg width={x} height={height}>
      <Rect x={0} y={0} width={x} height={height} fill="#ffffff" />
      {bars.map((b, i) => (
        <Rect key={i} x={b.x} y={0} width={b.width} height={height} fill="#000000" />
      ))}
    </Svg>
  );
}
