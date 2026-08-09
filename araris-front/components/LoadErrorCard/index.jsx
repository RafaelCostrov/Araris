import { Pressable, Text } from "react-native";


export default function LoadErrorCard({ message, onRetry }) {
  if (!message) {
    return null;
  }

  return (
    <Pressable
      className="rounded-2xl bg-red-50 p-4 active:opacity-80"
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Tentar carregar novamente"
    >
      <Text className="font-poppins-medium text-red-700">{message}</Text>
      <Text className="mt-1 font-poppins-regular text-sm text-red-600">
        Toque para tentar novamente.
      </Text>
    </Pressable>
  );
}
