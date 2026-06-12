import { Bell } from "lucide-react-native";
import { Image, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


export default function CustomHeader() {
  return (
    <SafeAreaView className="bg-azul-primario px-6 pb-4" edges={["top"]}>
      <View className="flex-row items-center justify-between h-16">
        <Image
          source={require("../../assets/images/logo_branco.png")}
          className="w-32 h-9"
          resizeMode="contain"
        />
        <View className="flex-row items-center gap-4">
          <TouchableOpacity activeOpacity={0.7}>
            <Bell color="#fff" size={25} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8}>
            <Image
              source={require("../../assets/images/foto_perfil.png")}
              className="w-9 h-9 rounded-full border border-white"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}