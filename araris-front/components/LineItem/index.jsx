import { View, Text, TouchableOpacity } from "react-native";

export default function LineItem({ title, value, date, icon, onPress }) {
  function formatValue(val) {
    const numericValue = parseFloat(val);
    if (isNaN(numericValue)) {
      return val;
    }
    return numericValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const formattedValue = formatValue(value);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row justify-between items-center bg-white w-full p-3 rounded-lg"
      onPress={onPress}
    >
      <View className="flex-row justify-between items-center bg-white w-full">
        <View className="flex-row items-center gap-2">
          <View className="p-2 rounded-xl bg-gray-200">{icon}</View>
          <View>
            <Text className="font-poppins-semibold text-texto-primario">
              {title}
            </Text>
            <Text className="font-poppins-light text-texto-terciario text-sm">
              {date}
            </Text>
          </View>
        </View>
        {parseFloat(value) > 0 ? (
          <Text className="font-poppins-semibold text-green-500 text-lg">
            + R$ {formattedValue.replace(".", ",")}
          </Text>
        ) : (
          <Text className="font-poppins-semibold text-red-500 text-lg">
            - R$ {formattedValue.replace(".", ",").replace("-", "")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
