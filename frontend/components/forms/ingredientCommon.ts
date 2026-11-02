// src/components/forms/ingredientCommon.ts
// ค่าร่วมที่ใช้ในฟอร์มวัตถุดิบทั้งฝั่งผู้ใช้และฝั่งแอดมิน

// พาเลตสีส้มของแอป
export const ORANGE = "#F28E2B";
export const ORANGE_DARK = "#C96A0A";
export const ORANGE_SOFT = "#FFEBD6";
export const ORANGE_LIGHT = "#FFF5EA";
export const ORANGE_BORDER = "#F6C48F";

// ให้พิมพ์ได้เฉพาะตัวเลขและจุดทศนิยม 1 จุด (รองรับคีย์บอร์ดที่ให้ "," มา)
export const sanitizeNumber = (text: string) => {
  const cleaned = text.replace(",", ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
};

// escape อักขระพิเศษของ ilike (% _ \) กันชื่อที่มีสัญลักษณ์เหล่านี้ทำให้ค้นซ้ำผิด
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => "\\" + c);

// ชื่อสารอาหารในตาราง nutrients (nutrient_name) -> ป้ายที่แสดงบนฟอร์ม
// ถ้ามีสารอาหารที่ไม่อยู่ในรายการนี้ จะแสดงชื่อดิบจากตารางแทน
export const NUTRIENT_LABELS: Record<string, string> = {
  energy: "Calories",
  protein: "Protein",
  sugar: "Sugar",
  tot_fat: "Total fat",
  sat_fat: "Saturated fat",
  trans_fat: "Trans fat",
  carbohydrate: "Carbohydrate",
  fiber: "Fiber",
  sodium: "Sodium",
  cholesterol: "Cholesterol",
  vit_a: "Vitamin A",
  vit_c: "Vitamin C",
  calcium: "Calcium",
  iron: "Iron",
};

// ชื่อที่ไม่อยู่ในรายการด้านบน: แปลง "some_name" เป็น "Some name"
const prettifyName = (name: string) => {
  const t = name.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const getNutrientLabel = (name: string) => NUTRIENT_LABELS[name] ?? prettifyName(name);

// สารอาหารหลัก 13 ตัวที่แสดงในฟอร์มก่อน (ชื่อตาม nutrients.nutrient_name) เรียงตามลำดับที่แสดงบนฟอร์ม
// ที่เหลือในตาราง nutrients ให้กด "Add more nutrients" เลือกเพิ่มได้ทีละหลายตัว
export const CORE_NUTRIENT_NAMES = [
  "energy", // Calories
  "protein",
  "sugar",
  "tot_fat", // TotalFat
  "sat_fat", // SaturatedFat
  "carbohydrate",
  "fiber",
  "sodium",
  "cholesterol",
  "vit_a", // VitA
  "vit_c", // VitC
  "calcium",
  "iron",
];
