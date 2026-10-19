import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, ActivityIndicator, View } from "react-native";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import PersonalDataForm from "@/components/forms/PersonalDataForm";
import AllergiesForm from "@/components/forms/AllergiesForm";
import GoalForm from "@/components/forms/GoalForm";
import PreferenceForm from "@/components/forms/PreferenceForm";
import { OnboardingFormData } from "@/src/types/OnboardingType";

const TOTAL_STEPS = 4;

const BLANK_FORM: OnboardingFormData = {
  gender: "",
  age: "",
  weight: "",
  height: "",
  intensity_exercise: "",
  goal: "",
  user_prefs: [],
  filter_tags: [],
};

export default function OnboardingWizard() {
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { user, refreshUserData } = useAuth();

  const [formData, setFormData] = useState<OnboardingFormData>(BLANK_FORM);

  // โหลด draft ที่เคยเก็บไว้ (ถ้ามี) ตอนเปิดหน้านี้ครั้งแรก แทนที่จะเริ่มที่ step 1 ว่างเปล่าเสมอ
  useEffect(() => {
    const loadDraft = async () => {
      if (!user) {
        setLoadingDraft(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("onboarding_drafts")
          .select("step, form_data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setStep(data.step || 1);
          setFormData({ ...BLANK_FORM, ...(data.form_data || {}) });
        }
      } catch (error) {
        console.error("Error loading onboarding draft:", error);
      } finally {
        setLoadingDraft(false);
      }
    };

    loadDraft();
  }, [user]);

  // เซฟ draft ทุกครั้งที่กด Next - เก็บแค่ formData + step ปัจจุบัน ไม่แตะตารางจริงเลย
  const saveDraft = async (nextStep: number, mergedData: OnboardingFormData) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("onboarding_drafts").upsert(
        {
          user_id: user.id,
          step: nextStep,
          form_data: mergedData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    } catch (error) {
      // เซฟ draft ไม่สำเร็จไม่ควรบล็อกผู้ใช้ไม่ให้ทำ onboarding ต่อ แค่ log ไว้เฉยๆ
      console.error("Error saving onboarding draft:", error);
    }
  };

  const handleNext = async (stepData: Partial<OnboardingFormData>) => {
    const merged = { ...formData, ...stepData };
    setFormData(merged);
    const nextStep = step + 1;
    setStep(nextStep);
    await saveDraft(nextStep, merged);
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

      // onboarding เสร็จสมบูรณ์แล้ว ไม่ต้องเก็บ draft ไว้อีกต่อไป
      await supabase.from("onboarding_drafts").delete().eq("user_id", user.id);

      await refreshUserData();
      router.replace("/(app)/(tabs)/chatbot");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDraft) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
