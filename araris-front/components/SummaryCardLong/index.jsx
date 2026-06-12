import { View, Text, TouchableOpacity } from "react-native";
import { MoreVertical } from "lucide-react-native";

export default function SummaryCardLong({
  title,
  children,
}) {
  return (
    <View className="bg-white rounded-2xl p-4 gap-1 shadow-sm w-full">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="font-poppins-semibold text-texto-primario text-lg">{title}</Text>
        <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
          <MoreVertical color="#9ca3af" size={20} />
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}
