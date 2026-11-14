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

function CheckRow({
  checked,
  onPress,
  children,
}: {
  checked: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.checkboxRow} onPress={onPress}>
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={22}
        color={checked ? "#FF7A00" : "#888"}
      />
      <Text style={styles.checkboxText}>{children}</Text>
    </TouchableOpacity>
  );
}

export default function TermsConsentScreen() {
  const { user, refreshUserData } = useAuth();
  const router = useRouter();

  // all required
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedData, setAgreedData] = useState(false);
  const [agreedHealth, setAgreedHealth] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = agreedTerms && agreedData && agreedHealth;

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
      <Text style={styles.title}>Terms & Your Data</Text>
      <Text style={styles.subtitle}>
        Here is what this app collects, why, and who else handles it. Please
        read it before you continue.
      </Text>

      <ScrollView
        style={styles.scrollBox}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.sectionHeader}>1. What we collect</Text>
        <Text style={styles.bodyText}>
          • Account: your email, username, display name and profile picture.
          {"\n"}• Body and goal (only what you choose to enter): age, gender,
          height, weight, activity level and your goal. If you skip these, the
          app uses default daily targets.
          {"\n"}• Food: your allergies, diets, and the food types you like or
          dislike.
          {"\n"}• Activity in the app: meals you record as eaten, likes and
          saves, the recommendations shown to you, and your chat messages.
          {"\n"}• Content you add: posts, recipes, photos and custom
          ingredients.
        </Text>

        <Text style={styles.sectionHeader}>2. How we use it</Text>
        <Text style={styles.bodyText}>
          We use it to set your daily nutrient targets, score how well a meal
          fits them, leave out meals that match your allergies or diet, and rank
          meals by what you like. What you like, eat and skip slowly adjusts
          your food preferences, and recently shown meals are used to keep
          suggestions varied. Your data is never sold.
        </Text>

        <Text style={styles.sectionHeader}>3. Who else sees or handles it</Text>
        <Text style={styles.bodyText}>
          • Other users can see your posts, recipes, custom ingredients and
          display name. Your body data, allergies and eaten-meal records are not
          shown to other users.
          {"\n"}• The chatbot sends your chat messages, and text you type into
          AI-assisted forms, to an AI language service (Groq) to write replies.
          Your profile and body data are not sent. Please don't put personal
          details in chat.
          {"\n"}• Our service providers help run the app: Supabase (database and
          sign-in), Brevo (verification emails) and our hosting provider.
        </Text>

        <Text style={styles.sectionHeader}>4. Medical & health disclaimer</Text>
        <Text style={styles.bodyText}>
          Recipe suggestions, meal plans and nutrition numbers are for
          information only. They are not medical advice, diagnosis or treatment.
          Talk to a doctor or registered dietitian before changing your diet.
        </Text>

        <Text style={styles.sectionHeader}>
          5. Allergies and recipe accuracy
        </Text>
        <Text style={styles.bodyText}>
          Allergy and diet filters rely on ingredient labels and can be wrong or
          incomplete. Recipes, steps and ingredients added by other users may be
          unverified and their nutrition values are estimates. You are
          responsible for checking ingredients before you eat.
        </Text>

        <Text style={styles.sectionHeader}>Required</Text>
        <View style={styles.checkboxContainer}>
          <CheckRow
            checked={agreedTerms}
            onPress={() => setAgreedTerms(!agreedTerms)}
          >
            I have read and agree to these terms and to the use of my data
            described above.
          </CheckRow>
          <CheckRow
            checked={agreedData}
            onPress={() => setAgreedData(!agreedData)}
          >
            I agree that the body details I choose to enter (age, gender,
            height, weight, activity level and goal) will be used to set my
            daily nutrient targets.
          </CheckRow>
          <CheckRow
            checked={agreedHealth}
            onPress={() => setAgreedHealth(!agreedHealth)}
          >
            I understand the suggestions are not medical advice and that I must
            check allergens myself.
          </CheckRow>
        </View>
      </ScrollView>

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
    backgroundColor: "#FAFAFA",
    marginBottom: 16,
  },
  scrollContent: { padding: 16 },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
    marginBottom: 4,
  },
  bodyText: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 12 },
  checkboxContainer: { gap: 12, marginBottom: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
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
