import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/config";
import { useAuth } from "../../contexts/AuthContext";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [highQuality, setHighQuality] = useState(false);
  const [autoDeleteAudio, setAutoDeleteAudio] = useState(true);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const handleVoiceEnroll = () => {
    Alert.alert("Voice Enrollment", "Record a 10-second voice sample so HuddleSync can identify you in meetings.", [
      { text: "Cancel", style: "cancel" },
      { text: "Start Recording", onPress: () => {} },
    ]);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, right, onPress }: { icon: string; label: string; right?: React.ReactNode; onPress?: () => void }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Ionicons name={icon as any} size={20} color={Colors.primary} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      {right || (onPress && <Ionicons name="chevron-forward" size={18} color={Colors.border} />)}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Profile">
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.displayName || "Unknown"}</Text>
            <Text style={styles.profileEmail}>{user?.email || ""}</Text>
          </View>
        </View>
      </Section>

      <Section title="Team">
        <Row icon="people" label="Manage Team" onPress={() => {}} />
        <Row icon="person-add" label="Invite Members" onPress={() => {}} />
      </Section>

      <Section title="Audio">
        <Row
          icon="musical-notes"
          label="High Quality Recording"
          right={<Switch value={highQuality} onValueChange={setHighQuality} trackColor={{ true: Colors.primary }} />}
        />
        <Row
          icon="volume-mute"
          label="Noise Suppression"
          right={<Switch value={noiseSuppression} onValueChange={setNoiseSuppression} trackColor={{ true: Colors.primary }} />}
        />
      </Section>

      <Section title="Voice Enrollment">
        <Row icon="mic" label="Enroll My Voice" onPress={handleVoiceEnroll} />
        <Text style={styles.hint}>
          Record a short voice sample so HuddleSync can identify you automatically during meetings.
        </Text>
      </Section>

      <Section title="Data & Privacy">
        <Row
          icon="trash"
          label="Auto-delete Audio"
          right={<Switch value={autoDeleteAudio} onValueChange={setAutoDeleteAudio} trackColor={{ true: Colors.primary }} />}
        />
        <Row icon="shield-checkmark" label="Privacy Policy" onPress={() => {}} />
      </Section>

      <Section title="Integrations">
        <Row icon="logo-slack" label="Slack" onPress={() => {}} />
        <Row icon="clipboard" label="Jira" onPress={() => {}} />
        <Row icon="document-text" label="Notion" onPress={() => {}} />
      </Section>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 },
  sectionContent: { backgroundColor: Colors.card, borderRadius: 12, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  rowIcon: { marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: Colors.text },
  profileRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: Colors.white },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: "600", color: Colors.secondary },
  profileEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 12, color: Colors.textSecondary, paddingHorizontal: 16, paddingVertical: 10 },
  logoutButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 30, marginHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.card, borderRadius: 12, gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: Colors.error },
});
