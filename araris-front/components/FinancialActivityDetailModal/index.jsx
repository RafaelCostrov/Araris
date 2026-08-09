import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";

import CategoryIcon from "../CategoryIcon";
import {
  formatApiDate,
  formatCurrency,
} from "../../utils/financeFormatters";


export default function FinancialActivityDetailModal({
  item,
  visible,
  isSubmitting = false,
  onClose,
  onEdit,
  onDelete,
}) {
  const [lastItem, setLastItem] = useState(item);

  useEffect(() => {
    if (item) {
      setLastItem(item);
    }
  }, [item]);

  const displayedItem = item ?? lastItem;
  const isRevenue = displayedItem?.type === "revenue";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-center bg-black/40 px-6"
        onPress={onClose}
      >
        <Pressable
          className="gap-5 rounded-3xl bg-white p-6"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-poppins-semibold text-2xl text-texto-primario">
                {displayedItem?.description}
              </Text>
              <Text className="font-poppins-regular text-texto-terciario">
                {formatApiDate(displayedItem?.date)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              <Text className="font-poppins-semibold text-lg text-texto-terciario">
                Fechar
              </Text>
            </Pressable>
          </View>

          <View className="rounded-2xl bg-gray-100 p-4">
            <Text className="mb-1 font-poppins-medium text-sm text-texto-terciario">
              Valor
            </Text>
            <Text
              className={`font-poppins-semibold text-2xl ${
                isRevenue ? "text-green-600" : "text-red-600"
              }`}
            >
              {isRevenue ? "+ " : "- "}
              {formatCurrency(displayedItem?.amount)}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            <CategoryIcon category={displayedItem?.category} withBackground />
            <View className="gap-1">
              <Text className="font-poppins-medium text-sm text-texto-terciario">
                Categoria
              </Text>
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                {displayedItem?.category_label}
              </Text>
            </View>
          </View>

          <View className="gap-1">
            <Text className="font-poppins-medium text-sm text-texto-terciario">
              Tipo de lançamento
            </Text>
            <Text
              className={`font-poppins-semibold ${
                displayedItem?.is_recurring
                  ? "text-blue-700"
                  : "text-texto-primario"
              }`}
            >
              {displayedItem?.is_recurring
                ? `Recorrente · ${displayedItem.recurrence_label}`
                : "Lançamento simples"}
            </Text>
          </View>

          <View className="gap-1">
            <Text className="font-poppins-medium text-sm text-texto-terciario">
              {isRevenue ? "Cliente" : "Fornecedor"}
            </Text>
            <Text className="font-poppins-regular text-texto-primario">
              {isRevenue
                ? displayedItem?.customer_name || "Outros (sem vínculo)"
                : displayedItem?.supplier_name || "Outros (sem vínculo)"}
            </Text>
          </View>

          <View className="gap-1">
            <Text className="font-poppins-medium text-sm text-texto-terciario">
              Forma de pagamento
            </Text>
            <Text className="font-poppins-regular text-texto-primario">
              {displayedItem?.payment_method_label}
            </Text>
          </View>

          <View className="gap-1">
            <Text className="font-poppins-medium text-sm text-texto-terciario">
              Observações
            </Text>
            <Text className="font-poppins-regular leading-6 text-texto-primario">
              {displayedItem?.notes || "Nenhuma observação adicional."}
            </Text>
          </View>

          <View className="flex-row gap-3 pt-2">
            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-azul-primario p-3 active:bg-blue-50"
              onPress={onEdit}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              <Pencil size={18} color="#0063f5" />
              <Text className="font-poppins-semibold text-azul-primario">
                Editar
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-red-300 p-3 active:bg-red-50"
              onPress={onDelete}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#b91c1c" />
              ) : (
                <Trash2 size={18} color="#b91c1c" />
              )}
              <Text className="font-poppins-semibold text-red-700">
                Remover
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
