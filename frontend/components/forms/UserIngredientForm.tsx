// src/components/forms/UserIngredientForm.tsx

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
