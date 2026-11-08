import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDateString } from "@/src/utils/date";

const keyFor = (userId: string) => `likePrompt:lastAskedDate:${userId}`;
export async function shouldAskLike(userId: string): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(keyFor(userId));
    console.log("[shouldAskLike] last asked date for user", userId, "is", last);
    return last !== localDateString();
  } catch {
    return false;
  }
}

export async function markAskedLike(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), localDateString());
  } catch {
    console.warn("[markAskedLike] failed to store last asked date for user", userId);
  }
}