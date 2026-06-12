import { View, TouchableOpacity } from "react-native";
import { Plus } from "lucide-react-native";

export default function AddButton({ onPress }) {
  return (
    <TouchableOpacity
      className="flex-1 items-center justify-center -top-1"
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View className="w-[58px] h-[58px] rounded-full bg-azul-primario items-center justify-center shadow-md shadow-azul-primario">
        <Plus color="#fff" size={26} strokeWidth={2.5} />
      </View>
    </TouchableOpacity>
  );
}