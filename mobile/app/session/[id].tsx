import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/config";
import { useSessionStore } from "../../stores/sessionStore";

const NUM_BARS = 24;

function WaveformVisualizer({ isActive }: { isActive: boolean }) {
  const animatedValues = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    if (!isActive) {
      animatedValues.forEach((v) => v.setValue(0.15));
      return;
    }

    const animations = animatedValues.map((animValue) => {
      const animate = () => {
        const target = 0.2 + Math.random() * 0.8;
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: target,
            duration: 150 + Math.random() * 200,
            useNativeDriver: false,
          }),
          Animated.timing(animValue, {
            toValue: 0.15 + Math.random() * 0.25,
            duration: 150 + Math.random() * 200,
            useNativeDriver: false,
          }),
        ]).start(animate);
      };
      // Stagger start
      setTimeout(animate, Math.random() * 400);
      return animValue;
    });

    return () => {
      animations.forEach((v) => v.stopAnimation());
    };
  }, [isActive]);

  return (
    <View style={styles.waveformContainer}>
      {animatedValues.map((animValue, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              height: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 80],
              }),
              backgroundColor: isActive ? Colors.primary : Colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function LiveSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    isRecording, isPaused, duration, transcriptSegments, currentSpeaker,
    pauseSession, resumeSession, endSession,
  } = useSessionStore();

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [transcriptSegments.length]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndHuddle = () => {
    Alert.alert("End Huddle", "Are you sure you want to end this huddle?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Huddle",
        style: "destructive",
        onPress: async () => {
          await endSession();
          router.replace(`/summary/${id}`);
        },
      },
    ]);
  };

  const speakerColors: Record<string, string> = {};
  const colorPalette = ["#4A90D9", "#27AE60", "#E67E22", "#9B59B6", "#E74C3C", "#1ABC9C"];
  let colorIndex = 0;

  const getSpeakerColor = (label: string) => {
    if (!speakerColors[label]) {
      speakerColors[label] = colorPalette[colorIndex % colorPalette.length];
      colorIndex++;
    }
    return speakerColors[label];
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Timer and status */}
      <View style={styles.topBar}>
        <View style={styles.timerContainer}>
          <View style={[styles.recordingDot, { backgroundColor: isPaused ? Colors.warning : Colors.error }]} />
          <Text style={styles.timer}>{formatTime(duration)}</Text>
        </View>
        {currentSpeaker && (
          <View style={[styles.speakerBadge, { backgroundColor: getSpeakerColor(currentSpeaker.speakerLabel) }]}>
            <Text style={styles.speakerBadgeText}>
              {currentSpeaker.matchedUserName || currentSpeaker.speakerLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Waveform */}
      <View style={styles.waveformSection}>
        <WaveformVisualizer isActive={isRecording && !isPaused} />
        <Text style={styles.waveformLabel}>
          {isPaused ? "Paused" : isRecording ? "Listening..." : "Idle"}
        </Text>
      </View>

      {/* Live transcript */}
      <View style={styles.transcriptSection}>
        <Text style={styles.transcriptTitle}>Live Transcript</Text>
        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
        >
          {transcriptSegments.length === 0 ? (
            <Text style={styles.transcriptPlaceholder}>
              Transcript will appear here as people speak...
            </Text>
          ) : (
            transcriptSegments.map((seg, i) => (
              <View key={i} style={styles.transcriptEntry}>
                <View style={[styles.speakerDot, { backgroundColor: getSpeakerColor(seg.speakerLabel) }]} />
                <View style={styles.transcriptTextContainer}>
                  <Text style={[styles.speakerName, { color: getSpeakerColor(seg.speakerLabel) }]}>
                    {seg.userName || seg.speakerLabel}
                  </Text>
                  <Text style={styles.transcriptText}>{seg.text}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={isPaused ? resumeSession : pauseSession}
        >
          <Ionicons name={isPaused ? "play" : "pause"} size={28} color={Colors.primary} />
          <Text style={styles.controlLabel}>{isPaused ? "Resume" : "Pause"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endButton} onPress={handleEndHuddle}>
          <Ionicons name="stop" size={28} color={Colors.white} />
          <Text style={styles.endButtonText}>End Huddle</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5 },
  timer: { fontSize: 32, fontWeight: "700", color: Colors.secondary, fontVariant: ["tabular-nums"] },
  speakerBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  speakerBadgeText: { color: Colors.white, fontSize: 13, fontWeight: "600" },
  waveformSection: { alignItems: "center", paddingVertical: 20 },
  waveformContainer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 80, gap: 3,
  },
  waveformBar: { width: 4, borderRadius: 2 },
  waveformLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  transcriptSection: { flex: 1, paddingHorizontal: 20 },
  transcriptTitle: { fontSize: 16, fontWeight: "700", color: Colors.secondary, marginBottom: 8 },
  transcriptScroll: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  transcriptContent: { padding: 16 },
  transcriptPlaceholder: { color: Colors.textSecondary, fontSize: 14, fontStyle: "italic", textAlign: "center", paddingTop: 40 },
  transcriptEntry: { flexDirection: "row", marginBottom: 12, alignItems: "flex-start" },
  speakerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  transcriptTextContainer: { flex: 1 },
  speakerName: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  transcriptText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  controls: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 20, gap: 20,
  },
  pauseButton: {
    alignItems: "center", justifyContent: "center",
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.primary,
  },
  controlLabel: { fontSize: 10, color: Colors.primary, fontWeight: "600", marginTop: 2 },
  endButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30,
    backgroundColor: Colors.error, gap: 8,
  },
  endButtonText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
});
