import { View, Text, TouchableOpacity } from "react-native";

export default function LineItem({
  title,
  value,
  date,
  icon,
  indicator,
  isRecurring,
  onPress,
}) {
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
      <View className="flex-row justify-between items-center bg-white w-full gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          {icon}
          <View className="flex-1">
            <Text
              className="font-poppins-semibold text-texto-primario"
              numberOfLines={1}
            >
              {title}
            </Text>
            <View className="flex-row items-center gap-2 mt-1 flex-wrap">
              <Text className="font-poppins-light text-texto-terciario text-xs">
                {date}
              </Text>
              {indicator ? (
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    isRecurring ? "bg-blue-50" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`font-poppins-medium text-[10px] ${
                      isRecurring ? "text-blue-700" : "text-gray-500"
                    }`}
                  >
                    {indicator}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {parseFloat(value) > 0 ? (
          <Text className="font-poppins-semibold text-green-500 text-base">
            + R$ {formattedValue.replace(".", ",")}
          </Text>
        ) : (
          <Text className="font-poppins-semibold text-red-500 text-base">
            - R$ {formattedValue.replace(".", ",").replace("-", "")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
