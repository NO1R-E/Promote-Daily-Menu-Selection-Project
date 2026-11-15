// src/components/forms/AdminIngredientForm.tsx

import IngredientForm from "./ingredientForm";

type Props = {
  title?: string; // ส่ง "" เพื่อซ่อนหัวข้อ
  submitLabel?: string;
  onSaved?: (ingredientId: number) => void;
  onCancel?: () => void;
};

export default function AdminIngredientForm({
  title = "Add Ingredient (Admin)",
  submitLabel = "Save Ingredient",
  onSaved,
  onCancel,
}: Props) {
  return (
    <IngredientForm
      mode="admin"
      title={title}
      submitLabel={submitLabel}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
