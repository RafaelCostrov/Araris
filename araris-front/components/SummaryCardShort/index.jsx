import { View, Text } from "react-native";
import { ArrowUp, ArrowDown } from "lucide-react-native";
import Card from "../Card";

export default function SummaryCardShort({
  icon,
  title,
  value,
  underValue,
  change,
  positive,
  period,
  onPress,
}) {
  return (
    <Card
      className="gap-1 flex-1"
      onPress={onPress}
      disabled={!onPress}
    >
      <View className="mb-2">
        {icon}
      </View>

      <Text className="text-gray-500 font-poppins-medium text-sm mb-2">{title}</Text>

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
        ) : (
          <View />
        )}
        <Text className="text-gray-400 font-poppins-light-italic text-sm">{period}</Text>
      </View>
    </Card>
  );
}
