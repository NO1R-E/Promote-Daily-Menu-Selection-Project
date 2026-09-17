// app/(onboarding)/index.tsx
import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import PersonalDataForm from "@/components/forms/PersonalDataForm";
import AllergiesForm from "@/components/forms/AllergiesForm";
import GoalForm from "@/components/forms/GoalForm";
import PreferenceForm from "@/components/forms/PreferenceForm";
import { OnboardingFormData } from "@/src/types/OnboardingType";

// Step order — step 5 (meal card swipe, refining dietary_prefs further)
// is not built yet. It would slot in right after PreferenceForm, still
// writing into the same dietary_prefs array before the final submit.
const TOTAL_STEPS = 4;

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { user, refreshUserData } = useAuth();

  const [formData, setFormData] = useState<OnboardingFormData>({
    gender: "",
    age: "",
    weight: "",
    height: "",
    intensity_exercise: "",
    goal: "",
    user_prefs: [],
    filter_tags: [],
  });

  const handleNext = (stepData: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleFinalSubmit = async (finalData: Partial<OnboardingFormData>) => {
    if (!user) {
      Alert.alert("Error", "User not authenticated. Please log in again.");
      return;
    }
    const completeData = { ...formData, ...finalData };
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("complete_onboarding", {
        p_user_id: user.id,
        p_gender: completeData.gender,
        p_age: Number(completeData.age),
        p_height: Number(completeData.height),
        p_weight: Number(completeData.weight),
        p_intensity_exercise: completeData.intensity_exercise,
        p_goal: completeData.goal,
        p_filter_tags: completeData.filter_tags,
        p_user_prefs: completeData.user_prefs,
      });
      if (error) throw error;

      await refreshUserData();
      router.replace("/(app)/(tabs)/chatbot");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {step === 1 && (
        <PersonalDataForm
          initialData={formData}
          buttonLabel={`Next (1/${TOTAL_STEPS})`}
          onSubmit={handleNext}
        />
      )}
      {step === 2 && (
        <AllergiesForm
          initialData={formData}
          buttonLabel={`Next (2/${TOTAL_STEPS})`}
          onSubmit={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 3 && (
        <GoalForm
          initialData={formData}
          buttonLabel={`Next (3/${TOTAL_STEPS})`}
          onSubmit={handleNext}
          onBack={handleBack}
        />
      )}
      {step === 4 && (
        <PreferenceForm
          initialData={formData}
          buttonLabel={submitting ? "Saving..." : "Complete Setup"}
          disabled={submitting ? true : false}
          onSubmit={handleFinalSubmit}
          onBack={handleBack}
        />
      )}
    </>
  );
}
