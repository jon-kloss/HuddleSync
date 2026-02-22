import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/config";
import { useAuth } from "../../contexts/AuthContext";
import { useSessionStore } from "../../stores/sessionStore";
import { useAuthStore } from "../../stores/authStore";
import type { HuddleSession } from "../../types";
import { format } from "date-fns";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sessions, loadSessions, startSession } = useSessionStore();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (user?.teamId) {
      setLoading(true);
      loadSessions(user.teamId).finally(() => setLoading(false));
    }
  }, [user?.teamId]);

  const handleStartHuddle = async () => {
    if (!user?.teamId || !accessToken) return;
    setStarting(true);
    try {
      const sessionId = await startSession(user.teamId, accessToken);
      router.push(`/session/${sessionId}`);
    } catch (err) {
      console.error("Failed to start huddle:", err);
    } finally {
      setStarting(false);
    }
  };

  const formatDuration = (session: HuddleSession) => {
    if (!session.ended_at) return "In progress";
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const mins = Math.round((end - start) / 60000);
    return `${mins} min`;
  };

  const renderSession = ({ item }: { item: HuddleSession }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => router.push(`/summary/${item.session_id}`)}
    >
      <View style={styles.sessionCardHeader}>
        <Text style={styles.sessionDate}>
          {format(new Date(item.started_at), "MMM d, yyyy 'at' h:mm a")}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: item.status === "COMPLETED" ? Colors.success : Colors.warning }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.sessionCardBody}>
        <View style={styles.sessionMeta}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.sessionMetaText}>{formatDuration(item)}</Text>
        </View>
        <View style={styles.sessionMeta}>
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.sessionMetaText}>{item.starter?.display_name || "Unknown"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>HuddleSync</Text>
        <Text style={styles.subtitle}>{user?.teamId ? "Your Team" : "No team yet"}</Text>
      </View>

      <View style={styles.startSection}>
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={handleStartHuddle}
          disabled={starting || !user?.teamId}
          activeOpacity={0.7}
        >
          {starting ? (
            <ActivityIndicator color={Colors.white} size="large" />
          ) : (
            <>
              <Ionicons name="mic" size={48} color={Colors.white} />
              <Text style={styles.startButtonText}>Start Huddle</Text>
            </>
          )}
        </TouchableOpacity>
        {!user?.teamId && (
          <Text style={styles.noTeamText}>Create or join a team to start a huddle</Text>
        )}
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Huddles</Text>
        {loading ? (
          <ActivityIndicator style={styles.loader} color={Colors.primary} />
        ) : sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No huddles yet</Text>
            <Text style={styles.emptySubtext}>Start your first huddle above</Text>
          </View>
        ) : (
          <FlatList
            data={sessions.slice(0, 5)}
            keyExtractor={(item) => item.session_id}
            renderItem={renderSession}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: Colors.primary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  startSection: { alignItems: "center", paddingVertical: 24 },
  startButton: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: { color: Colors.white, fontSize: 14, fontWeight: "700", marginTop: 4 },
  noTeamText: { color: Colors.textSecondary, fontSize: 13, marginTop: 12 },
  recentSection: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.secondary, marginBottom: 12 },
  sessionCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sessionCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sessionDate: { fontSize: 14, fontWeight: "600", color: Colors.secondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: "700", color: Colors.white, textTransform: "uppercase" },
  sessionCardBody: { flexDirection: "row", gap: 16 },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionMetaText: { fontSize: 13, color: Colors.textSecondary },
  loader: { marginTop: 40 },
  emptyState: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: Colors.textSecondary, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
});
