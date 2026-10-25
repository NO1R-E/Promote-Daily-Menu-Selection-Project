import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

export default function TermsConsentScreen() {
  const { user, refreshUserData } = useAuth();
  const router = useRouter();

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedHealth, setAgreedHealth] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = agreedTerms && agreedHealth;

  const handleAccept = async () => {
    if (!user) return;
    setSubmitting(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({
        terms_accepted: true,
        terms_accepted_at: now,
      })
      .eq("profile_id", user.id);

    setSubmitting(false);

    if (error) {
      console.error("Error saving terms consent:", error);
      Alert.alert("Error", "Failed to record agreements. Please try again.");
    } else {
      if (refreshUserData) {
        await refreshUserData();
      }
      router.replace("/(onboarding)");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Terms & Health Disclaimer</Text>
      <Text style={styles.subtitle}>
        Please review and accept our guidelines before providing your physical
        and dietary metrics.
      </Text>

      <ScrollView style={styles.scrollBox} showsVerticalScrollIndicator={true}>
        <Text style={styles.sectionHeader}>
          1. Collection of Health & Dietary Data
        </Text>
        <Text style={styles.bodyText}>
          We collect personal attributes including age, height, weight, physical
          activity level, and food allergies to generate customized meal
          recommendations. Your data is protected and never sold to third
          parties.
        </Text>

        <Text style={styles.sectionHeader}>2. Medical & Health Disclaimer</Text>
        <Text style={styles.bodyText}>
          Our recipe suggestions, meal plans, and nutritional counts are
          provided for educational and informational purposes only. They do NOT
          constitute professional medical advice, diagnosis, or treatment.
          Always consult a physician or registered dietitian before starting a
          new diet regime.
        </Text>

        <Text style={styles.sectionHeader}>3. Food Allergy Responsibility</Text>
        <Text style={styles.bodyText}>
          While our allergen filtering feature helps exclude specified
          ingredients, recipe databases may contain inaccuracies or
          cross-contamination warnings. You remain solely responsible for
          verifying ingredients prior to consumption.
        </Text>
      </ScrollView>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreedTerms(!agreedTerms)}
        >
          <Ionicons
            name={agreedTerms ? "checkbox" : "square-outline"}
            size={22}
            color={agreedTerms ? "#FF7A00" : "#888"}
          />
          <Text style={styles.checkboxText}>
            I agree to the Terms of Service &amp; Privacy Policy.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreedHealth(!agreedHealth)}
        >
          <Ionicons
            name={agreedHealth ? "checkbox" : "square-outline"}
            size={22}
            color={agreedHealth ? "#FF7A00" : "#888"}
          />
          <Text style={styles.checkboxText}>
            I acknowledge that recommendations do not substitute medical advice.
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !isFormValid && styles.continueBtnDisabled]}
        disabled={!isFormValid || submitting}
        onPress={handleAccept}
      >
        {submitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.continueBtnText}>Accept &amp; Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  scrollBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FAFAFA",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
    marginBottom: 4,
  },
  bodyText: { fontSize: 13, color: "#555", lineHeight: 18, marginBottom: 12 },
  checkboxContainer: { gap: 12, marginBottom: 20 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkboxText: { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  continueBtn: {
    backgroundColor: "#FF7A00",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  continueBtnDisabled: { backgroundColor: "#CCC" },
  continueBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});
