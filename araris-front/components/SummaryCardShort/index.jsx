import { View, Text, TouchableOpacity } from "react-native";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react-native";

export default function SummaryCardShort({ icon, title, value, underValue, change, positive, period }) {
  return (
    <View className="bg-white rounded-2xl p-4 gap-1 shadow-sm flex-1">
      <View className="flex-row justify-between items-center mb-4">
        {icon}
        <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
          <MoreVertical color="#9ca3af" size={20} />
        </TouchableOpacity>
      </View>

      <Text className="text-gray-500 font-poppins-medium text-sm mb-1">{title}</Text>

      <Text className="text-2xl text-center font-poppins-semibold text-texto-primario mb-4">{value}</Text>

      <View className="flex-row justify-between items-center">
        {positive !== undefined ? (
          <View className="flex-row items-center gap-1">
            {positive ? (
              <ArrowUp color="#22c55e" size={12} strokeWidth={2.5} />
            ) : (
              <ArrowDown color="#ef4444" size={12} strokeWidth={2.5} />
            )}
            <Text
              className={`font-poppins-medium text-sm ${positive ? "text-green-500" : "text-red-500"}`}
            >
            {change}
            </Text>
          </View>
        ) : <View />}
        <Text className="text-gray-400 font-poppins-light-italic text-sm">{period}</Text>
      </View>
    </View>
  );
}
