import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/src/config/supabase";
import { useAuth } from "@/src/contexts/AuthContext";

type ChatRoom = {
  room_id: number;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

function CustomDrawerContent(props: any) {
  const { currentRoom, onSelectRoom, userId, navigation, state } = props;
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchRooms = async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("chat_rooms")
      .select("room_id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRooms(data);

      if (currentRoom === null && data.length > 0) {
        onSelectRoom(data[0].room_id.toString());
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, [userId, currentRoom]);

  const handleLongPress = (room: ChatRoom) => {
    setSelectedRoom(room);
    setNewTitle(room.title || `Chat #${room.room_id}`);
    setIsRenaming(false);
    setIsModalVisible(true);
  };

  const handleRename = async () => {
    if (!selectedRoom || !newTitle.trim()) return;

    const { error } = await supabase
      .from("chat_rooms")
      .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
      .eq("room_id", selectedRoom.room_id);

    if (error) {
      Alert.alert("Error", "Could not rename chat room.");
    } else {
      setIsModalVisible(false);
      fetchRooms();
    }
  };

  const handleDelete = async () => {
    if (!selectedRoom) return;

    Alert.alert(
      "Delete Chat",
      `Are you sure you want to delete "${selectedRoom.title || `Chat #${selectedRoom.room_id}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("chat_rooms")
              .delete()
              .eq("room_id", selectedRoom.room_id);

            if (error) {
              Alert.alert("Error", "Could not delete chat room.");
            } else {
              if (String(currentRoom) === String(selectedRoom.room_id)) {
                onSelectRoom(null);
                navigation.navigate("chatbot", { currentRoom: null });
              }
              setIsModalVisible(false);
              fetchRooms();
            }
          },
        },
      ],
    );
  };

  const navItems = [
    { name: "forum", label: "Home", icon: "home" },
    { name: "chatbot", label: "ChatBot", icon: "chatbox" },
    { name: "record", label: "Record", icon: "fitness" },
    { name: "profile", label: "Profile", icon: "person-circle" },
  ];

  const activeRouteName = state?.routes[state?.index]?.name;

  return (
    <ScrollView
      style={styles.drawerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      {navItems.map((item) => {
        const isActive = activeRouteName === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => {
              navigation.navigate(item.name);
              navigation.closeDrawer();
            }}
          >
            <Ionicons
              name={item.icon as any}
              size={20}
              color={isActive ? "#FF7A00" : "#666"}
            />
            <Text style={[styles.navText, isActive && styles.navTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Chat History</Text>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => {
            onSelectRoom(null);
            navigation.navigate("chatbot", { currentRoom: null });
            navigation.closeDrawer();
          }}
        >
          <Ionicons name="add" size={16} color="#FF7A00" />
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 8 }} color="#FF7A00" />
      ) : (
        <FlatList
          data={rooms}
          scrollEnabled={false}
          keyExtractor={(item) => item.room_id.toString()}
          contentContainerStyle={styles.roomList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No chat history found.</Text>
          }
          renderItem={({ item }) => {
            const isSelected = String(currentRoom) === String(item.room_id);
            return (
              <TouchableOpacity
                style={[styles.roomItem, isSelected && styles.roomItemActive]}
                onPress={() => {
                  const roomIdStr = item.room_id.toString();
                  onSelectRoom(roomIdStr);
                  navigation.navigate("chatbot", { currentRoom: roomIdStr });
                  navigation.closeDrawer();
                }}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={300}
              >
                <Text
                  style={[styles.roomText, isSelected && styles.roomTextActive]}
                  numberOfLines={1}
                >
                  {item.title || `Chat #${item.room_id}`}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* MENU */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedRoom?.title || `Chat #${selectedRoom?.room_id}`}
            </Text>

            {isRenaming ? (
              <View style={styles.renameContainer}>
                <TextInput
                  style={styles.renameInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  autoFocus
                />
                <View style={styles.renameActionRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setIsRenaming(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleRename}
                  >
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.menuOptions}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setIsRenaming(true)}
                >
                  <Ionicons name="pencil-outline" size={18} color="#333" />
                  <Text style={styles.menuText}>Rename Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={[styles.menuText, { color: "#FF3B30" }]}>
                    Delete Chat
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => (
          <CustomDrawerContent
            {...props}
            userId={user?.id}
            currentRoom={currentRoom}
            onSelectRoom={(roomId: string | null) => setCurrentRoom(roomId)}
          />
        )}
        screenOptions={{
          drawerActiveTintColor: "orange",
          drawerHideStatusBarOnOpen: true,
        }}
      >
        <Drawer.Screen
          name="forum"
          options={{
            drawerLabel: "Home",
            title: "Home",
            drawerIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
            headerTitleAlign: "center",
          }}
        />
        <Drawer.Screen
          name="chatbot"
          options={{
            drawerLabel: "ChatBot",
            title: "ChatBot",
            drawerIcon: ({ color, size }) => (
              <Ionicons name="chatbox" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="record"
          options={{
            drawerLabel: "Record",
            title: "Record",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="fitness" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: "Profile",
            title: "Profile",
            drawerIcon: ({ size, color }) => (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingTop: 45, paddingBottom: 16 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    borderRadius: 8,
    gap: 12,
  },
  navItemActive: { backgroundColor: "#FFF3E0" },
  navText: { fontSize: 14, fontWeight: "500", color: "#444" },
  navTextActive: { color: "#FF7A00", fontWeight: "bold" },
  divider: { height: 1, backgroundColor: "#E0E0E0", marginVertical: 8 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: "#888" },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#FFF3E0",
  },
  newChatText: { fontSize: 12, fontWeight: "600", color: "#FF7A00" },
  roomList: { paddingHorizontal: 10, gap: 1 },
  roomItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  roomItemActive: { backgroundColor: "#FFF3E0" },
  roomText: { fontSize: 13, color: "#444" },
  roomTextActive: { fontWeight: "bold", color: "#FF7A00" },
  emptyText: {
    paddingHorizontal: 16,
    color: "#999",
    fontSize: 13,
    marginTop: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "80%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  menuOptions: { gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  menuText: { fontSize: 14, fontWeight: "500", color: "#333" },
  renameContainer: { gap: 10 },
  renameInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  renameActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: "#666", fontSize: 13 },
  saveBtn: {
    backgroundColor: "#FF7A00",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  saveText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});
