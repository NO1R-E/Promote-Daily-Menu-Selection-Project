// One small pop-up used for BOTH
//   - an ingredient's own unit  (e.g. egg = 50 g)     -> mode "ingredient"
//   - a shared unit             (e.g. tbsp = 14.79 ml) -> mode "shared"  (admin screen)
// It adds, edits and (when onDelete is given) removes a unit. Errors from the database are shown inside.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { sanitizeNumber } from "./ingredientCommon";
import { unitErrorMessage } from "./units";

const ORANGE = "#F28E2B";
const ORANGE_DARK = "#C96A0A";

export type UnitEditorValues = {
  nameEn: string;
  nameTh: string;
  value: number; // grams of 1 unit (ingredient / shared weight) or millilitres of 1 unit (shared volume)
  kind: "weight" | "volume";
};

type Props = {
  visible: boolean;
  mode: "ingredient" | "shared";
  // what the title says the unit belongs to, e.g. the ingredient name
  subject?: string;
  // undefined = adding a new unit
  initial?: Partial<UnitEditorValues> & { isSystem?: boolean; usedCount?: number };
  onClose: () => void;
  onSave: (v: UnitEditorValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export default function UnitEditorModal({
  visible,
  mode,
  subject,
  initial,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const isNew = initial === undefined || initial.nameEn === undefined;
  const isSystem = !!initial?.isSystem;
  const [nameEn, setNameEn] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"weight" | "volume">("weight");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset the fields every time the pop-up opens
  useEffect(() => {
    if (!visible) return;
    setNameEn(initial?.nameEn ?? "");
    setNameTh(initial?.nameTh ?? "");
    setValue(initial?.value != null ? String(initial.value) : "");
    setKind(initial?.kind ?? "weight");
    setError(null);
    setBusy(false);
  }, [visible]);

  const unitWord = mode === "ingredient" ? "g" : kind === "volume" ? "ml" : "g";
  const title =
    mode === "ingredient"
      ? isNew
        ? `Add a unit${subject ? ` for ${subject}` : ""}`
        : "Edit unit"
      : isNew
        ? "Add shared unit"
        : "Edit shared unit";

  const submit = async () => {
    const n = nameEn.trim();
    const v = Number(value);
    if (!n) return setError("Please enter a unit name, e.g. egg.");
    if (!(v >= 0.1 && v <= 5000))
      return setError(`The amount must be between 0.1 and 5000 ${unitWord}.`);
    setBusy(true);
    setError(null);
    try {
      await onSave({ nameEn: n, nameTh: nameTh.trim(), value: v, kind });
      onClose();
    } catch (e: any) {
      setError(unitErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const askDelete = () => {
    if (!onDelete) return;
    Alert.alert(
      "Remove this unit?",
      "Recipes that already use it are not changed, but a unit used by a recipe can't be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await onDelete();
              onClose();
            } catch (e: any) {
              setError(unitErrorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, isSystem && styles.inputLocked]}
            value={nameEn}
            onChangeText={setNameEn}
            placeholder={mode === "ingredient" ? "e.g. egg, clove, slice" : "e.g. pinch"}
            placeholderTextColor="#999"
            maxLength={30}
            editable={!busy && !isSystem}
          />

          <Text style={styles.label}>Thai name (optional)</Text>
          <TextInput
            style={styles.input}
            value={nameTh}
            onChangeText={setNameTh}
            placeholder="เช่น ฟอง"
            placeholderTextColor="#999"
            maxLength={30}
            editable={!busy}
          />

          {mode === "shared" && (
            <>
              <Text style={styles.label}>Type</Text>
              <View style={styles.kindRow}>
                {(["weight", "volume"] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.kindChip, kind === k && styles.kindChipOn]}
                    disabled={busy || isSystem}
                    onPress={() => setKind(k)}
                  >
                    <Text style={kind === k ? styles.kindTextOn : styles.kindText}>
                      {k === "weight" ? "Weight (g)" : "Volume (ml)"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>
            {mode === "ingredient"
              ? "How many grams is 1 of it?"
              : kind === "volume"
                ? "How many millilitres is 1 of it?"
                : "How many grams is 1 of it?"}
          </Text>
          <View style={styles.valueRow}>
            <TextInput
              style={[styles.input, { flex: 1 }, isSystem && styles.inputLocked]}
              value={value}
              onChangeText={(t) => setValue(sanitizeNumber(t))}
              placeholder="50"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              editable={!busy && !isSystem}
            />
            <Text style={styles.unitWord}>{unitWord}</Text>
          </View>

          {isSystem && (
            <Text style={styles.note}>
              This unit is needed by the app. Only its Thai name can change.
            </Text>
          )}
          {mode === "ingredient" && (
            <Text style={styles.note}>
              {isNew ? "This will be the default unit of this ingredient. " : ""}
              Everyone can use it for this ingredient. Only you and admins can
              change or remove it.
            </Text>
          )}
          {!!initial?.usedCount && initial.usedCount > 0 && (
            <Text style={styles.note}>
              Used in {initial.usedCount} recipe{initial.usedCount > 1 ? "s" : ""}.
              Saved recipes keep the grams they already have.
            </Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.btn, styles.cancel]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.save, busy && { opacity: 0.6 }]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveText}>{isNew ? "Add" : "Save"}</Text>
              )}
            </TouchableOpacity>
          </View>

          {!isNew && onDelete && !isSystem && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={askDelete}
              disabled={busy}
            >
              <Text style={styles.deleteText}>Remove this unit</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  card: { backgroundColor: "#FFF", borderRadius: 16, padding: 18 },
  title: { fontSize: 17, fontWeight: "700", color: ORANGE_DARK, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#3A3A3C", marginTop: 12, marginBottom: 6 },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: "#F6C48F",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#333",
    backgroundColor: "#F8F9FA",
  },
  inputLocked: { backgroundColor: "#EEE", color: "#888" },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  unitWord: { fontSize: 15, color: "#666", width: 28 },
  kindRow: { flexDirection: "row", gap: 8 },
  kindChip: {
    borderWidth: 1,
    borderColor: "#F6C48F",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
  },
  kindChipOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  kindText: { fontSize: 13, color: ORANGE_DARK, fontWeight: "600" },
  kindTextOn: { fontSize: 13, color: "#FFF", fontWeight: "700" },
  note: { fontSize: 12, color: "#8E8E93", marginTop: 8 },
  error: { fontSize: 13, color: "#FF3B30", marginTop: 10 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: "#F2F2F7" },
  cancelText: { color: "#8E8E93", fontWeight: "600", fontSize: 15 },
  save: { backgroundColor: ORANGE },
  saveText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  deleteBtn: { alignItems: "center", marginTop: 14 },
  deleteText: { color: "#FF3B30", fontWeight: "600", fontSize: 14 },
});
