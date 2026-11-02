// src/components/forms/UserIngredientForm.tsx
// ฟอร์มเพิ่มวัตถุดิบของผู้ใช้ (ตัวบางๆ ครอบ IngredientForm ที่ใช้ร่วมกับฝั่งแอดมิน)
// วัตถุดิบถูกบันทึกลงตาราง ingredients (status = 'unverified', source 'user') ผ่านฟังก์ชัน create_ingredient

import IngredientForm from "./ingredientForm";

type Props = {
  onSaved?: () => void;
  onCancel?: () => void;
};

export function UserIngredientForm({ onSaved, onCancel }: Props) {
  return (
    <IngredientForm
      mode="user"
      title="Add Ingredient"
      onSaved={() => onSaved?.()}
      onCancel={onCancel}
    />
  );
}

export default UserIngredientForm;
