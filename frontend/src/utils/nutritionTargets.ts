// คำนวณเป้าหมายพลังงานและสารอาหารรายวัน ตามเป้าหมายของผู้ใช้
// หมายเหตุ: ค่าคงที่ทั้งหมดอยู่ใน CONFIG ด้านล่าง ปรับได้ที่เดียว
// ค่าเหล่านี้เลือกภายในช่วงที่งานวิจัยแนะนำ (ไม่ใช่ค่าที่เปเปอร์ระบุตรงๆ)

export type Goal = "general" | "lose_weight" | "build_muscle";
export type Sex = "male" | "female";

export interface TargetProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityFactor: number; // 1.2 - 1.9
  goal: Goal;
}

export interface Targets {
  calories: number; // kcal
  fat: number; // g
  protein: number; // g
  carbs: number; // g
  fiber: number; // g
  sugar: number; // g (ขีดจำกัดสูงสุด)
  sodium: number; // mg (ขีดจำกัดสูงสุด)
}

// ค่าเดิมของแอป ใช้เป็น fallback เมื่อยังไม่มีข้อมูลโปรไฟล์ครบ
export const DEFAULT_TARGETS: Targets = {
  calories: 2000,
  fat: 65,
  protein: 60,
  carbs: 300,
  fiber: 25,
  sugar: 50,
  sodium: 2000,
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

const CONFIG = {
  // ทั่วไป
  general: {
    proteinPerKg: 0.8, // RDA
    fatPct: 0.3, // AMDR 20-35%
  },
  // ลดน้ำหนัก
  loseWeight: {
    deficitPctOfTdee: 0.2,
    deficitMinKcal: 500, // AHA/ACC/TOS 2013
    deficitMaxKcal: 750,
    kcalFloorMale: 1500,
    kcalFloorFemale: 1200,
    proteinPerKg: 2.0, // ช่วง 1.6-2.4
    fatPct: 0.25, // Helms 2014: 15-30%
  },
  // เพิ่มกล้ามเนื้อ
  buildMuscle: {
    surplusPct: 0.15, // Iraki 2019: 10-20%
    surplusMaxPct: 0.2,
    proteinPerKg: 1.8, // ช่วง 1.6-2.2
    fatPerKg: 1.0, // Iraki 2019: 0.5-1.5
    fatPerKgMin: 0.5,
    carbsMinPerKg: 3, // Iraki 2019: >= 3-5 g/kg
  },
  // ค่าร่วมทุกเป้าหมาย (WHO)
  common: {
    fiberG: 25,
    sugarPctOfKcal: 0.1, // น้ำตาลอิสระ < 10% ของพลังงาน
    sodiumMg: 2000,
  },
  minAdultAge: 18,
};

// BMR: สูตร Mifflin-St Jeor
export const calcBMR = (p: Pick<TargetProfile, "weightKg" | "heightCm" | "age" | "sex">): number => {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
};

export const calcTDEE = (p: TargetProfile): number => calcBMR(p) * p.activityFactor;

const isValidProfile = (p: TargetProfile | null | undefined): p is TargetProfile =>
  !!p &&
  p.weightKg >= 30 && p.weightKg <= 300 &&
  p.heightCm >= 120 && p.heightCm <= 230 &&
  p.age >= CONFIG.minAdultAge && p.age <= 100 &&
  p.activityFactor >= 1.2 && p.activityFactor <= 1.9 &&
  (p.sex === "male" || p.sex === "female");

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

// ประกอบ Targets จาก kcal / โปรตีน(g) / ไขมัน(g) โดยให้คาร์บเป็นส่วนที่เหลือ
const buildTargets = (kcal: number, proteinG: number, fatG: number): Targets => {
  const carbsG = Math.max(
    0,
    (kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs
  );
  return {
    calories: Math.round(kcal),
    protein: Math.round(proteinG),
    fat: Math.round(fatG),
    carbs: Math.round(carbsG),
    fiber: CONFIG.common.fiberG,
    sugar: Math.round((CONFIG.common.sugarPctOfKcal * kcal) / KCAL_PER_G.carbs),
    sodium: CONFIG.common.sodiumMg,
  };
};

const calcGeneral = (p: TargetProfile, tdee: number): Targets => {
  const c = CONFIG.general;
  return buildTargets(tdee, c.proteinPerKg * p.weightKg, (c.fatPct * tdee) / KCAL_PER_G.fat);
};

const calcLoseWeight = (p: TargetProfile, tdee: number): Targets => {
  const c = CONFIG.loseWeight;
  const deficit = clamp(c.deficitPctOfTdee * tdee, c.deficitMinKcal, c.deficitMaxKcal);
  const floor = p.sex === "male" ? c.kcalFloorMale : c.kcalFloorFemale;
  // ไม่ต่ำกว่า floor และไม่เกิน TDEE (กันกรณี TDEE ต่ำกว่า floor)
  const kcal = Math.min(tdee, Math.max(tdee - deficit, floor));
  return buildTargets(kcal, c.proteinPerKg * p.weightKg, (c.fatPct * kcal) / KCAL_PER_G.fat);
};

const calcBuildMuscle = (p: TargetProfile, tdee: number): Targets => {
  const c = CONFIG.buildMuscle;
  const proteinG = c.proteinPerKg * p.weightKg;
  const minCarbsG = c.carbsMinPerKg * p.weightKg;

  let surplus = c.surplusPct;
  let fatPerKg = c.fatPerKg;
  let result = buildTargets(tdee * (1 + surplus), proteinG, fatPerKg * p.weightKg);

  // ถ้าคาร์บต่ำกว่าขั้นต่ำ: ลดไขมันทีละ 0.1 g/กก. (ไม่ต่ำกว่า fatPerKgMin) ก่อน แล้วค่อยเพิ่ม surplus (ไม่เกิน surplusMaxPct)
  while (result.carbs < minCarbsG) {
    if (fatPerKg - 0.1 >= c.fatPerKgMin - 1e-9) {
      fatPerKg = round1(fatPerKg - 0.1);
    } else if (surplus + 0.01 <= c.surplusMaxPct + 1e-9) {
      surplus = Math.round((surplus + 0.01) * 100) / 100;
    } else {
      break; // ถึงขีดจำกัดแล้ว ใช้ค่าล่าสุด
    }
    result = buildTargets(tdee * (1 + surplus), proteinG, fatPerKg * p.weightKg);
  }
  return result;
};

// ฟังก์ชันหลัก: ถ้าโปรไฟล์ไม่ครบหรือไม่ผ่านการตรวจ จะคืนค่าเดิม (DEFAULT_TARGETS)
// รวมถึงผู้ใช้อายุต่ำกว่า 18 ปี ที่สูตรเหล่านี้ไม่ได้ออกแบบมารองรับ
export const calculateTargets = (profile: TargetProfile | null | undefined): Targets => {
  if (!isValidProfile(profile)) return DEFAULT_TARGETS;
  const tdee = calcTDEE(profile);
  switch (profile.goal) {
    case "lose_weight":
      return calcLoseWeight(profile, tdee);
    case "build_muscle":
      return calcBuildMuscle(profile, tdee);
    default:
      return calcGeneral(profile, tdee);
  }
};

// ---------- แปลง personalData จาก AuthContext เป็น TargetProfile ----------
// คอลัมน์ในตาราง personalData: gender (male|female), age, height (ซม.), weight (กก.),
// intensity_exercise (low|medium|high), goal (maintain_weight|lose_weight|build_muscle)
const FIELD_ALIASES = {
  weight: ["weight"],
  height: ["height"],
  age: ["age"],
  sex: ["gender"],
  activity: ["intensity_exercise"],
  goal: ["goal"],
};

// แปลงระดับความหนักของการออกกำลังกายเป็น activity factor (การตัดสินใจออกแบบของผู้พัฒนา ปรับได้)
const ACTIVITY_MAP: Record<string, number> = {
  low: 1.375,
  medium: 1.55,
  high: 1.725,
};

const normalizeKey = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

// หาค่าแรกที่ไม่ว่างจากแหล่งข้อมูลที่ให้มา
const pick = (sources: any[], keys: string[]): any => {
  for (const src of sources) {
    if (!src) continue;
    for (const k of keys) {
      const v = src[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
};

// รับ personalData (และ object อื่นถ้ามี) เช่น parseTargetProfile(personalData)
// goal: maintain_weight หรือไม่มีค่า => "general"
export const parseTargetProfile = (...sources: any[]): TargetProfile | null => {
  const a = FIELD_ALIASES;

  const g = normalizeKey(pick(sources, a.goal));
  const goal: Goal =
    g === "lose_weight"
      ? "lose_weight"
      : g === "build_muscle"
      ? "build_muscle"
      : "general";

  const s = normalizeKey(pick(sources, a.sex));
  const sex: Sex | null =
    s === "male" ? "male"
    : s === "female" ? "female"
    : null;

  const rawActivity = pick(sources, a.activity);
  const numActivity = Number(rawActivity);
  const activityFactor =
    Number.isFinite(numActivity) && numActivity > 0 ? numActivity : ACTIVITY_MAP[normalizeKey(rawActivity)];

  const age = Number(pick(sources, a.age));
  const weightKg = Number(pick(sources, a.weight));
  const heightCm = Number(pick(sources, a.height));

  if (!sex || !activityFactor) return null;
  return { weightKg, heightCm, age, sex, activityFactor, goal };
};
