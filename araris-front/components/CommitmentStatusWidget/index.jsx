import { Image, Pressable, Text, View } from "react-native";
import { TriangleAlert } from "lucide-react-native";

import Card from "../Card";
import { formatCurrency } from "../../utils/financeFormatters";


const VARIANTS = {
  overdue: {
    backgroundColor: "#b91c1c",
    iconColor: "#ffffff",
    titleColor: "#ffffff",
    amountColor: "rgba(255, 255, 255, 0.9)",
    amountClassName: "text-xs",
    buttonTextColor: "#e5003d",
    singular: "compromisso vencido",
    plural: "compromissos vencidos",
    image: require("../../assets/images/araris_brava.png"),
    imageLabel: "Araris brava",
  },
  due_today: {
    backgroundColor: "#facc15",
    iconColor: "#854d0e",
    titleColor: "#854d0e",
    amountColor: "#a16207",
    amountClassName: "text-sm",
    buttonTextColor: "#a16207",
    singular: "compromisso vence hoje",
    plural: "compromissos vencem hoje",
    image: require("../../assets/images/araris_supresa.png"),
    imageLabel: "Araris surpresa",
  },
};


export default function CommitmentStatusWidget({
  variant,
  count,
  payableAmount,
  receivableAmount,
  onPress,
}) {
  const config = VARIANTS[variant];
  if (!config || count <= 0) {
    return null;
  }

  return (
    <Card
      className="flex-row items-center gap-2 py-3"
      style={{ backgroundColor: config.backgroundColor }}
    >
      <View className="flex-1 items-center pr-1">
        <View className="flex-row items-center justify-center gap-1.5">
          <TriangleAlert size={17} color={config.iconColor} />
          <Text
            className="font-poppins-semibold"
            style={{ color: config.titleColor }}
            numberOfLines={2}
          >
            {count} {count === 1 ? config.singular : config.plural}
          </Text>
        </View>
        <Text
          className={`mt-1 font-poppins-regular ${config.amountClassName}`}
          style={{ color: config.amountColor }}
          numberOfLines={2}
        >
          A pagar: {formatCurrency(payableAmount)} · A receber:{" "}
          {formatCurrency(receivableAmount)}
        </Text>
        <Pressable
          className="mt-3 rounded-lg bg-white px-5 py-2 active:opacity-80"
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Visualizar ${count === 1 ? config.singular : config.plural}`}
        >
          <Text
            className="font-poppins-semibold text-xs"
            style={{ color: config.buttonTextColor }}
          >
            Visualizar
          </Text>
        </Pressable>
      </View>
      <Image
        source={config.image}
        className="h-20 w-20"
        resizeMode="contain"
        accessibilityLabel={config.imageLabel}
      />
    </Card>
  );
}
