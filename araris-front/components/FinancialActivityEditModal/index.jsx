import { useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import DateField from "../DateField";
import InputText from "../InputText";
import SearchableSelectField from "../SearchableSelectField";
import SelectField from "../SelectField";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  REVENUE_CATEGORIES,
} from "../../constants/financeOptions";
import {
  formatApiDate,
  formatDateInput,
  normalizeAmount,
  parseInputDate,
  todayIsoValue,
} from "../../utils/financeFormatters";


const EMPTY_FORM = {
  description: "",
  amount: "",
  date: "",
  category: "",
  paymentMethod: "pix",
  counterpartyId: "",
  notes: "",
};


export default function FinancialActivityEditModal({
  item,
  visible,
  customers = [],
  suppliers = [],
  isSubmitting = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [lastItem, setLastItem] = useState(item);
  const displayedItem = item ?? lastItem;
  const isRevenue = displayedItem?.type === "revenue";

  useLayoutEffect(() => {
    if (!visible || !item) {
      return;
    }
    setLastItem(item);
    setForm({
      description: item.description,
      amount: String(item.amount).replace(".", ","),
      date: formatApiDate(item.date),
      category: item.category,
      paymentMethod: item.payment_method,
      counterpartyId: item.customer_id ?? item.supplier_id ?? "",
      notes: item.notes ?? "",
    });
    setErrors({});
  }, [item, visible]);

  const contactOptions = useMemo(() => {
    const activeContacts = isRevenue ? customers : suppliers;
    const selectedContactId =
      displayedItem?.customer_id ?? displayedItem?.supplier_id ?? "";
    return [
      { value: "", label: "Sem vínculo (Outros)" },
      ...activeContacts.map((contact) => ({
        value: contact.id,
        label: contact.name,
      })),
      ...(selectedContactId &&
      !activeContacts.some((contact) => contact.id === selectedContactId)
        ? [
            {
              value: selectedContactId,
              label: `${
                displayedItem?.customer_name ?? displayedItem?.supplier_name
              } (inativo)`,
            },
          ]
        : []),
    ];
  }, [customers, displayedItem, isRevenue, suppliers]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function handleSubmit() {
    if (!displayedItem) {
      return;
    }
    const nextErrors = {};
    const amount = normalizeAmount(form.amount);
    const date = parseInputDate(form.date);

    if (!form.description.trim()) {
      nextErrors.description = "Informe uma descrição.";
    }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      nextErrors.amount = "Informe um valor maior que zero.";
    }
    if (!date) {
      nextErrors.date = "Informe uma data válida.";
    }
    if (!form.category) {
      nextErrors.category = "Selecione uma categoria.";
    }
    if (!form.paymentMethod) {
      nextErrors.paymentMethod = "Selecione uma forma de pagamento.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const originalCounterpartyId =
      displayedItem.customer_id ?? displayedItem.supplier_id ?? "";
    const counterpartyPayload =
      form.counterpartyId === originalCounterpartyId
        ? {}
        : isRevenue
          ? { customer_id: form.counterpartyId || null }
          : { supplier_id: form.counterpartyId || null };

    onSubmit({
      description: form.description.trim(),
      amount,
      occurred_on: date,
      category: form.category,
      payment_method: form.paymentMethod,
      ...counterpartyPayload,
      notes: form.notes.trim(),
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !isSubmitting && onClose()}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="max-h-[92%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
            <View>
              <Text className="font-poppins-semibold text-xl text-texto-primario">
                Editar atividade
              </Text>
              <Text className="font-poppins-regular text-sm text-texto-terciario">
                Atualize os dados do lançamento financeiro.
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={onClose}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Fechar edição"
            >
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingBottom: 36, gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            <InputText
              label="Descrição"
              placeholder="Descrição da atividade"
              value={form.description}
              onChangeText={(value) => updateForm("description", value)}
              error={errors.description}
              required
            />
            <InputText
              label="Valor"
              placeholder="0,00"
              value={form.amount}
              onChangeText={(value) => updateForm("amount", value)}
              keyboardType="decimal-pad"
              error={errors.amount}
              required
            />
            <DateField
              label="Data"
              placeholder="DD/MM/AAAA"
              value={form.date}
              onChangeText={(value) =>
                updateForm("date", formatDateInput(value))
              }
              error={errors.date}
              maximumDate={todayIsoValue()}
              required
            />
            <SelectField
              label="Categoria"
              options={isRevenue ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES}
              value={form.category}
              onChange={(value) => updateForm("category", value)}
              placeholder="Selecione uma categoria"
              error={errors.category}
              required
            />
            <SelectField
              label="Forma de pagamento"
              options={PAYMENT_METHODS}
              value={form.paymentMethod}
              onChange={(value) => updateForm("paymentMethod", value)}
              placeholder="Selecione uma forma"
              error={errors.paymentMethod}
              required
            />
            <SearchableSelectField
              label={`${isRevenue ? "Cliente" : "Fornecedor"} (opcional)`}
              options={contactOptions}
              value={form.counterpartyId}
              onChange={(value) => updateForm("counterpartyId", value)}
              placeholder="Digite para buscar um cadastro"
            />
            <InputText
              label="Observações"
              placeholder="Informações adicionais"
              value={form.notes}
              onChangeText={(value) => updateForm("notes", value)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Pressable
              className="items-center rounded-xl bg-azul-primario p-4 active:opacity-80"
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-poppins-semibold text-lg text-white">
                  Salvar alterações
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
