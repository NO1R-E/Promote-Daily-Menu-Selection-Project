export type Gender = "male" | "female" | "other";
export type ExerciseIntensity = "low" | "moderate" | "high";
export type Goal = "maintain_weight" | "lose_weight" | "build_muscle";

export type UserPref = {
  tag_id: number;
  vector: number;
};

export type OnboardingFormData = {
  gender: Gender | "";
  age: string;
  weight: string;
  height: string;
  intensity_exercise: ExerciseIntensity | "";
  goal: Goal | "";
  user_prefs: UserPref[];
  filter_tags: number[]; // tag_id[] — FILTER-category tags, written to user_filter
};