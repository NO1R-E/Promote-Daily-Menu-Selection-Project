import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";

type Ctx = {
  currentRoom: string | null;
  setCurrentRoom: (id: string | null) => void;
};

const ChatRoomContext = createContext<Ctx>({
  currentRoom: null,
  setCurrentRoom: () => {},
});

export function ChatRoomProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  useEffect(() => {
    setCurrentRoom(null);
  }, [user?.id]);

  return (
    <ChatRoomContext.Provider value={{ currentRoom, setCurrentRoom }}>
      {children}
    </ChatRoomContext.Provider>
  );
}

export const useChatRoom = () => useContext(ChatRoomContext);
