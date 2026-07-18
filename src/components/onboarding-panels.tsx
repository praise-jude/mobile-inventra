import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet, View } from 'react-native';

const PANEL_WIDTH = Math.min(Dimensions.get('window').width - 64, 340);
const PANEL_HEIGHT = 260;

// Shared rounded gradient card every hero panel below sits on top of — the
// gradient colors are the only thing that changes per page, drawn straight
// from the brand tokens in tailwind.config.js (no illustration assets).
// Uses expo-linear-gradient rather than the `experimental_backgroundImage`
// style prop — that's native-only (react-native-web doesn't translate it to
// CSS), where this renders identically on iOS/Android/web.
function PanelCard({ from, to, children }: { from: string; to: string; children: React.ReactNode }) {
  return (
    <LinearGradient colors={[from, to]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={styles.card}>
      {children}
    </LinearGradient>
  );
}

function IconChip({ source }: { source: number }) {
  return (
    <View style={styles.iconChip}>
      <Image source={source} style={styles.iconChipImage} contentFit="contain" />
    </View>
  );
}

export function InventoryPanel() {
  return (
    <PanelCard from="#2563eb" to="#4f46e5">
      <View style={styles.shelfStack}>
        {[0.9, 0.7, 1, 0.55].map((w, i) => (
          <View
            key={i}
            style={[styles.shelfBar, { width: (PANEL_WIDTH - 64) * w, opacity: 0.9 - i * 0.15 }]}
          />
        ))}
      </View>
      <IconChip source={require('@/assets/images/badge-inventory.png')} />
    </PanelCard>
  );
}

export function PosPanel() {
  return (
    <PanelCard from="#4f46e5" to="#0891b2">
      <View style={styles.receipt}>
        {[1, 0.75, 0.9, 0.6].map((w, i) => (
          <View key={i} style={[styles.receiptLine, { width: 120 * w }]} />
        ))}
        <View style={styles.receiptCheck}>
          <View style={styles.receiptCheckDot} />
        </View>
      </View>
      <View style={styles.barcode}>
        {[6, 3, 5, 2, 7, 4, 3, 6, 2, 5].map((h, i) => (
          <View key={i} style={[styles.barcodeBar, { height: 10 + h * 4 }]} />
        ))}
      </View>
    </PanelCard>
  );
}

export function InsightsPanel() {
  return (
    <PanelCard from="#10b981" to="#0891b2">
      <View style={styles.chartRow}>
        {[0.4, 0.65, 0.5, 0.85, 0.7, 1].map((h, i) => (
          <View key={i} style={[styles.chartBar, { height: 120 * h }]} />
        ))}
      </View>
      <IconChip source={require('@/assets/images/badge-insights.png')} />
    </PanelCard>
  );
}

export function BranchesPanel() {
  return (
    <PanelCard from="#f59e0b" to="#2563eb">
      <View style={styles.branchGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.branchTile}>
            <View style={styles.branchDotRow}>
              <View style={styles.branchDot} />
              <View style={[styles.branchDot, { opacity: 0.7 }]} />
              <View style={[styles.branchDot, { opacity: 0.45 }]} />
            </View>
          </View>
        ))}
      </View>
    </PanelCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  iconChip: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  iconChipImage: {
    width: 40,
    height: 40,
  },
  shelfStack: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  shelfBar: {
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  receipt: {
    width: 150,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'flex-start',
  },
  receiptLine: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#c9cfdb',
  },
  receiptCheck: {
    marginTop: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCheckDot: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  barcode: {
    position: 'absolute',
    bottom: 20,
    right: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 10,
    borderRadius: 10,
  },
  barcodeBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    height: 130,
  },
  chartBar: {
    width: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  branchGrid: {
    width: PANEL_WIDTH - 80,
    height: PANEL_HEIGHT - 80,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  branchTile: {
    width: '46%',
    height: '46%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchDotRow: {
    flexDirection: 'row',
    gap: 5,
  },
  branchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
});
