import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";

export default function FinanceConfirmationModal({
  visible,
  action,
  rows,
  isSubmitting,
  onClose,
  onConfirm,
}) {
  const Icon = action?.icon;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => !isSubmitting && onClose()}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-center px-6"
        onPress={() => !isSubmitting && onClose()}
      >
        <Pressable
          className="bg-white rounded-3xl p-5 gap-5 max-h-[85%]"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-row flex-1 items-center gap-3 pr-4">
              <View
                className="w-11 h-11 rounded-2xl items-center justify-center"
                style={{ backgroundColor: action?.background }}
              >
                {Icon ? <Icon size={22} color={action.color} /> : null}
              </View>
              <View className="flex-1">
                <Text className="font-poppins-semibold text-xl text-texto-primario">
                  Confirmar lançamento
                </Text>
                <Text className="font-poppins-regular text-sm text-texto-terciario">
                  Confira os dados antes de registrar.
                </Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} disabled={isSubmitting}>
              <X size={23} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView className="rounded-2xl bg-gray-50 px-4">
            {rows.map((row) => (
              <View
                key={row.label}
                className="flex-row justify-between gap-4 py-3 border-b border-gray-100"
              >
                <Text className="font-poppins-regular text-texto-terciario">
                  {row.label}
                </Text>
                <Text className="flex-1 text-right font-poppins-semibold text-texto-primario">
                  {row.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 border border-gray-300 rounded-xl p-4 items-center"
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text className="font-poppins-semibold text-texto-secundario">
                Voltar
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-azul-primario rounded-xl p-4 items-center"
              onPress={onConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-poppins-semibold text-white">
                  Confirmar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
