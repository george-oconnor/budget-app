import avatar from "@/assets/images/avatar.png";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

export default function Header({ name = "Alex Morgan" }: { name?: string }) {
  const { logout } = useSessionStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View className="flex-row items-center justify-between pt-4 pb-6">
      <View>
        <Text className="text-xs text-gray-500">Welcome back</Text>
        <Text className="text-2xl font-bold text-dark-100">{name}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <Feather name="bell" size={18} color="#181C2E" />
        </Pressable>
        <Pressable onPress={handleLogout}>
          <Image source={avatar} className="h-10 w-10 rounded-full" />
        </Pressable>
      </View>
    </View>
  );
}
