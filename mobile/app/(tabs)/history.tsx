import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/config";
import { useAuth } from "../../contexts/AuthContext";
import { useSessionStore } from "../../stores/sessionStore";
import type { HuddleSession } from "../../types";
import { format } from "date-fns";

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sessions, loadSessions } = useSessionStore();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.teamId) {
      loadSessions(user.teamId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.teamId]);

  const onRefresh = useCallback(async () => {
    if (!user?.teamId) return;
    setRefreshing(true);
    await loadSessions(user.teamId);
    setRefreshing(false);
  }, [user?.teamId]);

  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const lowerSearch = search.toLowerCase();
    return (
      s.starter?.display_name?.toLowerCase().includes(lowerSearch) ||
      format(new Date(s.started_at), "MMM d, yyyy").toLowerCase().includes(lowerSearch) ||
      s.status.toLowerCase().includes(lowerSearch)
    );
  });

  const formatDuration = (session: HuddleSession) => {
    if (!session.ended_at) return "In progress";
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    const mins = Math.round((end - start) / 60000);
    return `${mins} min`;
  };

  const renderItem = ({ item }: { item: HuddleSession }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/summary/${item.session_id}`)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.statusDot, {
          backgroundColor: item.status === "COMPLETED" ? Colors.success :
            item.status === "ACTIVE" ? Colors.primary : Colors.warning,
        }]} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardDate}>
          {format(new Date(item.started_at), "EEEE, MMM d, yyyy")}
        </Text>
        <Text style={styles.cardTime}>
          {format(new Date(item.started_at), "h:mm a")} · {formatDuration(item)}
        </Text>
        <Text style={styles.cardStarter}>
          Started by {item.starter?.display_name || "Unknown"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.border} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search huddles..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.session_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={Colors.border} />
            <Text style={styles.emptyTitle}>No huddles found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? "Try adjusting your search" : "Your completed huddles will appear here"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  searchContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 15, color: Colors.text },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 16,
    marginBottom: 8, flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardLeft: { marginRight: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardContent: { flex: 1 },
  cardDate: { fontSize: 15, fontWeight: "600", color: Colors.secondary },
  cardTime: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cardStarter: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.textSecondary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: "center" },
});
