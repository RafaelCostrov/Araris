import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import Card from "../Card";


export default function SettingsActionCard({
  icon,
  title,
  description,
  value,
  onPress,
}) {
  return (
    <Card
      className="flex-row items-center gap-3"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-poppins-semibold text-base text-texto-primario">
          {title}
        </Text>
        {description ? (
          <Text className="font-poppins-regular text-xs leading-5 text-texto-terciario">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text className="font-poppins-medium text-xs text-azul-primario">
          {value}
        </Text>
      ) : null}
      <ChevronRight size={20} color="#9ca3af" />
    </Card>
  );
}
