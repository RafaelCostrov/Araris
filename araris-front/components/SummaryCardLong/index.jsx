import { View, Text } from "react-native";
import Card from "../Card";

export default function SummaryCardLong({
  title,
  children,
}) {
  return (
    <Card className="gap-1 w-full">
      <View className="mb-4">
        <Text className="font-poppins-semibold text-texto-primario text-lg">{title}</Text>
      </View>
      {children}
    </Card>
  );
}
