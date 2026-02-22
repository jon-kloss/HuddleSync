import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/config";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="mic" size={40} color={Colors.white} />
          </View>
          <Text style={styles.appName}>HuddleSync</Text>
          <Text style={styles.tagline}>AI-Powered Team Huddle Recorder</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push("/register")}>
          <Text style={styles.registerLinkText}>
            Don't have an account? <Text style={styles.registerLinkBold}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  logoSection: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center", marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  appName: { fontSize: 28, fontWeight: "800", color: Colors.primary },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  form: { gap: 14 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FDE8E8", padding: 12, borderRadius: 10,
  },
  errorText: { fontSize: 13, color: Colors.error, flex: 1 },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, height: 50, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  loginButton: {
    backgroundColor: Colors.primary, borderRadius: 12, height: 50,
    justifyContent: "center", alignItems: "center", marginTop: 4,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: "700" },
  registerLink: { alignItems: "center", marginTop: 24 },
  registerLinkText: { fontSize: 14, color: Colors.textSecondary },
  registerLinkBold: { color: Colors.primary, fontWeight: "600" },
});
