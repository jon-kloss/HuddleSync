import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/config";
import { sessionsApi } from "../../services/api";
import { useSessionStore } from "../../stores/sessionStore";
import type { SpeakerUpdate, HuddleSummary } from "../../types";
import { format } from "date-fns";

function SpeakerCard({ speaker, index }: { speaker: SpeakerUpdate; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const colorPalette = ["#4A90D9", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C"];
  const color = colorPalette[index % colorPalette.length];

  const initials = (speaker.name || speaker.speakerLabel)
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const confidenceColor = speaker.confidence >= 0.8 ? Colors.success : speaker.confidence >= 0.5 ? Colors.warning : Colors.error;

  return (
    <View style={styles.speakerCard}>
      <TouchableOpacity style={styles.speakerCardHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={[styles.speakerAvatar, { backgroundColor: color }]}>
          <Text style={styles.speakerAvatarText}>{initials}</Text>
        </View>
        <View style={styles.speakerHeaderInfo}>
          <Text style={styles.speakerName}>{speaker.name || speaker.speakerLabel}</Text>
          <View style={styles.confidenceRow}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
            <Text style={styles.confidenceText}>{Math.round(speaker.confidence * 100)}% confidence</Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.speakerCardBody}>
          {speaker.yesterday ? (
            <View style={styles.updateSection}>
              <View style={styles.updateHeader}>
                <Ionicons name="arrow-back-circle-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.updateLabel}>Yesterday</Text>
              </View>
              <Text style={styles.updateText}>{speaker.yesterday}</Text>
            </View>
          ) : null}

          {speaker.today ? (
            <View style={styles.updateSection}>
              <View style={styles.updateHeader}>
                <Ionicons name="arrow-forward-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.updateLabel}>Today</Text>
              </View>
              <Text style={styles.updateText}>{speaker.today}</Text>
            </View>
          ) : null}

          {speaker.blockers.length > 0 && (
            <View style={styles.updateSection}>
              <View style={styles.updateHeader}>
                <Ionicons name="warning-outline" size={16} color={Colors.error} />
                <Text style={[styles.updateLabel, { color: Colors.error }]}>Blockers</Text>
              </View>
              {speaker.blockers.map((b, i) => (
                <View key={i} style={styles.blockerRow}>
                  <View style={styles.blockerDot} />
                  <Text style={styles.blockerText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {speaker.actionItems.length > 0 && (
            <View style={styles.updateSection}>
              <View style={styles.updateHeader}>
                <Ionicons name="checkbox-outline" size={16} color={Colors.success} />
                <Text style={[styles.updateLabel, { color: Colors.success }]}>Action Items</Text>
              </View>
              {speaker.actionItems.map((a, i) => (
                <View key={i} style={styles.actionRow}>
                  <Ionicons name="square-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.actionText}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentSummary } = useSessionStore();
  const [summary, setSummary] = useState<HuddleSummary | null>(currentSummary);
  const [loading, setLoading] = useState(!currentSummary);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!currentSummary && id) {
      loadSummary();
    }
  }, [id]);

  const loadSummary = async () => {
    try {
      const session = await sessionsApi.get(id!);
      setSessionDate(session.started_at);
      if (session.summaries && session.summaries.length > 0) {
        setSummary(session.summaries[0].content as unknown as HuddleSummary);
      }
    } catch (err) {
      console.error("Failed to load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  if (!summary || !summary.speakers || summary.speakers.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="document-text-outline" size={56} color={Colors.border} />
        <Text style={styles.emptyTitle}>No Summary Available</Text>
        <Text style={styles.emptySubtitle}>The summary will be generated when the huddle ends.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Meeting header */}
      <View style={styles.meetingHeader}>
        <Text style={styles.meetingTitle}>{summary.teamName || "Huddle"} Summary</Text>
        {sessionDate && (
          <Text style={styles.meetingDate}>
            {format(new Date(sessionDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </Text>
        )}
        <View style={styles.meetingStats}>
          <View style={styles.statBadge}>
            <Ionicons name="people" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{summary.speakers.length} speakers</Text>
          </View>
        </View>
      </View>

      {/* Speaker summaries */}
      {summary.speakers.map((speaker, i) => (
        <SpeakerCard key={speaker.speakerLabel + i} speaker={speaker} index={i} />
      ))}

      {/* Full transcript toggle */}
      <TouchableOpacity
        style={styles.transcriptToggle}
        onPress={() => setShowTranscript(!showTranscript)}
      >
        <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
        <Text style={styles.transcriptToggleText}>
          {showTranscript ? "Hide Full Transcript" : "View Full Transcript"}
        </Text>
        <Ionicons name={showTranscript ? "chevron-up" : "chevron-down"} size={18} color={Colors.primary} />
      </TouchableOpacity>

      {showTranscript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptPlaceholder}>
            Full transcript will be available after the session is processed.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background, padding: 40 },
  loadingText: { color: Colors.textSecondary, fontSize: 14, marginTop: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.textSecondary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: "center" },
  meetingHeader: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 20, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  meetingTitle: { fontSize: 20, fontWeight: "700", color: Colors.secondary },
  meetingDate: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  meetingStats: { flexDirection: "row", marginTop: 12, gap: 12 },
  statBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  statText: { fontSize: 12, color: Colors.primary, fontWeight: "500" },
  speakerCard: {
    backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  speakerCardHeader: {
    flexDirection: "row", alignItems: "center", padding: 16,
  },
  speakerAvatar: {
    width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  speakerAvatarText: { color: Colors.white, fontSize: 15, fontWeight: "700" },
  speakerHeaderInfo: { flex: 1 },
  speakerName: { fontSize: 16, fontWeight: "600", color: Colors.secondary },
  confidenceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  confidenceDot: { width: 6, height: 6, borderRadius: 3 },
  confidenceText: { fontSize: 11, color: Colors.textSecondary },
  speakerCardBody: { paddingHorizontal: 16, paddingBottom: 16 },
  updateSection: { marginTop: 12 },
  updateHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  updateLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textTransform: "uppercase" },
  updateText: { fontSize: 14, color: Colors.text, lineHeight: 20, marginLeft: 22 },
  blockerRow: { flexDirection: "row", alignItems: "flex-start", marginLeft: 22, marginTop: 4 },
  blockerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error, marginTop: 6, marginRight: 8 },
  blockerText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  actionRow: { flexDirection: "row", alignItems: "flex-start", marginLeft: 22, marginTop: 4, gap: 8 },
  actionText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  transcriptToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginTop: 8, gap: 8,
  },
  transcriptToggleText: { fontSize: 15, color: Colors.primary, fontWeight: "500" },
  transcriptContainer: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 16, marginTop: 8,
  },
  transcriptPlaceholder: { fontSize: 14, color: Colors.textSecondary, fontStyle: "italic", textAlign: "center" },
});
