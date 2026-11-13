import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";

// Cooking mode: the chat guides the user through one recipe. Kept in memory only, so closing the app ends it.
export type CookingSession = {
  recipe_id: number;
  name: string;
  step: number; // last step shown, 0 = not started
  pendingStart?: boolean; // the chat screen sends the opening message once, then clears this
};

type Ctx = {
  currentRoom: string | null;
  setCurrentRoom: (id: string | null) => void;
  cooking: CookingSession | null;
  setCooking: React.Dispatch<React.SetStateAction<CookingSession | null>>;
};

const ChatRoomContext = createContext<Ctx>({
  currentRoom: null,
  setCurrentRoom: () => {},
  cooking: null,
  setCooking: () => {},
});

export function ChatRoomProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [cooking, setCooking] = useState<CookingSession | null>(null);

  useEffect(() => {
    setCurrentRoom(null);
    setCooking(null);
  }, [user?.id]);

  return (
    <ChatRoomContext.Provider
      value={{ currentRoom, setCurrentRoom, cooking, setCooking }}
    >
      {children}
    </ChatRoomContext.Provider>
  );
}

export const useChatRoom = () => useContext(ChatRoomContext);
