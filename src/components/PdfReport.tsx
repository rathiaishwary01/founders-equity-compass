import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: "#ffffff",
  },
  // Cover
  coverBg: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
  },
  coverTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 4 },
  coverSub: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 20 },
  coverMeta: { fontSize: 9, color: "rgba(255,255,255,0.4)" },
  pillRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  pill: { flex: 1, backgroundColor: "#f0f4ff", borderRadius: 8, padding: 12, border: "1.5px solid #c7d9f8" },
  pillLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  pillVal: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#1a1a2e" },
  pillSub: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    marginBottom: 10,
    marginTop: 18,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionAccent: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#4361ee",
    marginRight: 6,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginTop: 18, borderBottom: "1px solid #e5e7eb", paddingBottom: 4 },
  // Insight
  insightBox: { backgroundColor: "#1a1a2e", borderRadius: 8, padding: 14, marginBottom: 6 },
  insightLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  insightText: { fontSize: 10, color: "#e2e8ff", lineHeight: 1.5 },
  signalRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 5 },
  signalDot: { width: 7, height: 7, borderRadius: 4, marginTop: 2 },
  signalText: { fontSize: 9, color: "rgba(255,255,255,0.8)", flex: 1, lineHeight: 1.4 },
  // Table
  table: { width: "100%" },
  tHead: { flexDirection: "row", backgroundColor: "#f9fafb", borderBottom: "1.5px solid #e5e7eb", paddingVertical: 6, paddingHorizontal: 8 },
  tRow: { flexDirection: "row", borderBottom: "1px solid #f3f4f6", paddingVertical: 7, paddingHorizontal: 8 },
  tCell: { fontSize: 9, color: "#1a1a2e" },
  tHdr: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase" },
  // Rec
  recItem: { flexDirection: "row", gap: 10, marginBottom: 12 },
  recNum: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#4361ee", flexShrink: 0 },
  recNumText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", textAlign: "center", marginTop: 4 },
  recAction: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a1a2e", lineHeight: 1.4 },
  recImpact: { fontSize: 9, color: "#4361ee", marginTop: 2, lineHeight: 1.4 },
  recDetail: { fontSize: 8, color: "#6b7280", marginTop: 2, lineHeight: 1.45 },
  // Board status badge
  boardBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  boardBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 8,
  },
  footerText: { fontSize: 8, color: "#9ca3af" },
});

// ── Types ────────────────────────────────────────────────────────────────────
export interface PdfData {
  scenarioName: string;
  market: string;
  generatedAt: string;
  founderPct: number;
  vcPct: number;
  valuation: string;
  boardStatus: string;
  insightSummary: string;
  riskSignals: Array<{ tone: "red" | "orange" | "yellow" | "green"; text: string }>;
  capTable: Array<{ name: string; role: string; pct: number; type: string }>;
  boardRows: Array<{ round: string; founderPct: number; vcPct: number; indPct: number; status: string }>;
  recommendations: Array<{ action: string; impact: string; detail: string }>;
  exitValue: string;
  payouts: Array<{ name: string; role: string; payout: string; pctOfExit: string; note: string }>;
  founderTotal: string;
  vcOverhang: string;
  disclaimer: string;
}

const TONE_COLORS: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
};

const BOARD_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Founder-controlled": { bg: "#dcfce7", text: "#166534" },
  "Tied":               { bg: "#fef9c3", text: "#854d0e" },
  "VC-controlled":      { bg: "#fee2e2", text: "#991b1b" },
};

// ── Section heading (no emoji, styled bar) ───────────────────────────────────
function SectionHeading({ label }: { label: string }) {
  return (
    <View style={S.sectionRow}>
      <View style={[S.sectionAccent, { height: 14 }]} />
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a2e", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

// ── Document ─────────────────────────────────────────────────────────────────
export function PdfReport({ data }: { data: PdfData }) {
  return (
    <Document title={data.scenarioName} author="EquiCompass" creator="EquiCompass">
      <Page size="A4" style={S.page}>

        {/* ── Cover block ── */}
        <View style={S.coverBg}>
          <Text style={S.coverTitle}>EquiCompass</Text>
          <Text style={S.coverSub}>Equity & VC Negotiation Simulator</Text>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: "#a5b4fc", marginBottom: 4 }}>
            {data.scenarioName}
          </Text>
          <Text style={S.coverMeta}>Generated {data.generatedAt} · Market: {data.market} · For negotiation planning only</Text>
        </View>

        {/* ── Summary pills ── */}
        <View style={S.pillRow}>
          <View style={S.pill}>
            <Text style={S.pillLabel}>Founders Combined</Text>
            <Text style={S.pillVal}>{data.founderPct.toFixed(1)}%</Text>
            <Text style={S.pillSub}>{data.founderPct > 51 ? "Majority" : data.founderPct > 35 ? "Caution" : "Minority"}</Text>
          </View>
          <View style={S.pill}>
            <Text style={S.pillLabel}>Post-money Val.</Text>
            <Text style={S.pillVal}>{data.valuation}</Text>
            <Text style={S.pillSub}>Latest round</Text>
          </View>
          <View style={S.pill}>
            <Text style={S.pillLabel}>Board Control</Text>
            <Text style={S.pillVal}>{data.boardStatus.replace(/[^\x20-\x7E]/g, "").trim()}</Text>
          </View>
          <View style={S.pill}>
            <Text style={S.pillLabel}>Total VC Stake</Text>
            <Text style={S.pillVal}>{data.vcPct.toFixed(1)}%</Text>
          </View>
        </View>

        {/* ── Insight ── */}
        <SectionHeading label="Founder Outcome Summary" />
        <View style={S.insightBox}>
          <Text style={S.insightLabel}>Outcome Summary</Text>
          <Text style={S.insightText}>{data.insightSummary}</Text>
          {data.riskSignals.map((s, i) => (
            <View key={i} style={S.signalRow}>
              <View style={[S.signalDot, { backgroundColor: TONE_COLORS[s.tone] }]} />
              <Text style={S.signalText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Cap table ── */}
        <SectionHeading label="Cap Table (Latest Round)" />
        <View style={S.table}>
          <View style={S.tHead}>
            <Text style={[S.tHdr, { flex: 3 }]}>Stakeholder</Text>
            <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>Ownership %</Text>
            <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>Type</Text>
          </View>
          {data.capTable.map((h, i) => (
            <View key={i} wrap={false} style={[S.tRow, i % 2 === 0 ? { backgroundColor: "#ffffff" } : { backgroundColor: "#fafafa" }]}>
              <View style={{ flex: 3 }}>
                <Text style={[S.tCell, { fontFamily: "Helvetica-Bold" }]}>{h.name}</Text>
                <Text style={[S.tCell, { color: "#9ca3af", fontSize: 8 }]}>{h.role}</Text>
              </View>
              <Text style={[S.tCell, { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{h.pct.toFixed(2)}%</Text>
              <Text style={[S.tCell, { flex: 1, textAlign: "right", color: "#6b7280" }]}>{h.type}</Text>
            </View>
          ))}
        </View>

        {/* ── Board composition ── */}
        {data.boardRows.length > 0 && (
          <>
            <SectionHeading label="Board Composition by Round" />
            <View style={S.table}>
              <View style={S.tHead}>
                <Text style={[S.tHdr, { flex: 2 }]}>Round</Text>
                <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>Founders</Text>
                <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>VCs</Text>
                <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>Indep.</Text>
                <Text style={[S.tHdr, { flex: 2, textAlign: "right" }]}>Status</Text>
              </View>
              {data.boardRows.map((b, i) => {
                const colors = BOARD_STATUS_COLORS[b.status] ?? { bg: "#f3f4f6", text: "#6b7280" };
                return (
                  <View key={i} wrap={false} style={[S.tRow, i % 2 === 0 ? { backgroundColor: "#ffffff" } : { backgroundColor: "#fafafa" }]}>
                    <Text style={[S.tCell, { flex: 2, fontFamily: "Helvetica-Bold" }]}>{b.round}</Text>
                    <Text style={[S.tCell, { flex: 1, textAlign: "right" }]}>{b.founderPct}%</Text>
                    <Text style={[S.tCell, { flex: 1, textAlign: "right" }]}>{b.vcPct}%</Text>
                    <Text style={[S.tCell, { flex: 1, textAlign: "right" }]}>{b.indPct}%</Text>
                    <View style={{ flex: 2, alignItems: "flex-end" }}>
                      <View style={[S.boardBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[S.boardBadgeText, { color: colors.text }]}>{b.status}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Recommendations ── */}
        <SectionHeading label="Recommended Negotiation Actions" />
        {data.recommendations.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#6b7280" }}>No active recommendations.</Text>
        ) : (
          data.recommendations.map((r, i) => (
            <View key={i} wrap={false} style={S.recItem}>
              <View style={S.recNum}>
                <Text style={S.recNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.recAction}>{r.action}</Text>
                <Text style={S.recImpact}>{r.impact}</Text>
                <Text style={S.recDetail}>{r.detail}</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Exit payouts ── */}
        <SectionHeading label={"Exit Payouts at " + data.exitValue} />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
          <View style={[S.pill, { flex: 1 }]}>
            <Text style={S.pillLabel}>VC Overhang</Text>
            <Text style={[S.pillVal, { fontSize: 12 }]}>{data.vcOverhang}</Text>
            <Text style={S.pillSub}>Paid before founders</Text>
          </View>
          <View style={[S.pill, { flex: 1 }]}>
            <Text style={S.pillLabel}>Founder Total</Text>
            <Text style={[S.pillVal, { fontSize: 12 }]}>{data.founderTotal}</Text>
            <Text style={S.pillSub}>Combined take-home</Text>
          </View>
        </View>
        <View style={S.table}>
          <View style={S.tHead}>
            <Text style={[S.tHdr, { flex: 3 }]}>Stakeholder</Text>
            <Text style={[S.tHdr, { flex: 2, textAlign: "right" }]}>Payout</Text>
            <Text style={[S.tHdr, { flex: 1, textAlign: "right" }]}>% of Exit</Text>
            <Text style={[S.tHdr, { flex: 2, textAlign: "right" }]}>Note</Text>
          </View>
          {data.payouts.map((p, i) => (
            <View key={i} wrap={false} style={[S.tRow, i % 2 === 0 ? { backgroundColor: "#ffffff" } : { backgroundColor: "#fafafa" }]}>
              <View style={{ flex: 3 }}>
                <Text style={[S.tCell, { fontFamily: "Helvetica-Bold" }]}>{p.name}</Text>
                <Text style={[S.tCell, { color: "#9ca3af", fontSize: 8 }]}>{p.role}</Text>
              </View>
              <Text style={[S.tCell, { flex: 2, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{p.payout}</Text>
              <Text style={[S.tCell, { flex: 1, textAlign: "right" }]}>{p.pctOfExit}</Text>
              <Text style={[S.tCell, { flex: 2, textAlign: "right", color: "#6b7280", fontSize: 8 }]}>{p.note}</Text>
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>EquiCompass · {data.scenarioName}</Text>
          <Text style={S.footerText}>For negotiation planning only — not legal or financial advice</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
