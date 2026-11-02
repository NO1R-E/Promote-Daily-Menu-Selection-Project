// src/components/forms/AdminIngredientForm.tsx
// ฟอร์มฝั่งแอดมิน เพิ่มวัตถุดิบหลัก (ตัวบางๆ ครอบ IngredientForm ที่ใช้ร่วมกับฝั่งผู้ใช้)
// บันทึกลง ingredients + ingredient_nutrients + ingredient_tags ผ่านฟังก์ชัน create_ingredient
// ฟังก์ชันตรวจบทบาทแอดมินเองฝั่งฐานข้อมูล แล้วตั้ง status = 'verified' (source 'admin') ให้
// วางในหน้าที่มี ScrollView อยู่แล้วได้เลย (ฟอร์มไม่มี ScrollView ในตัว)

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
