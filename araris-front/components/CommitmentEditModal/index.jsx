import { useLayoutEffect, useState } from "react";
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
import { Pencil, Trash2, X } from "lucide-react-native";

import {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
} from "../../constants/financeOptions";
import DateField from "../DateField";
import InputText from "../InputText";
import SearchableSelectField from "../SearchableSelectField";
import SelectField from "../SelectField";


function formatApiDate(value) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}


function formatDateInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}


function parseDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}


function normalizeAmount(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
}


function initialForm(item) {
  return {
    description: item?.description ?? "",
    amount: item?.amount ? String(item.amount).replace(".", ",") : "",
    date: formatApiDate(item?.due_date),
    category: item?.category ?? "",
    counterpartyId: item?.supplier_id ?? item?.customer_id ?? "",
    notes: item?.notes ?? "",
  };
}


export default function CommitmentEditModal({
  item,
  customers,
  suppliers,
  isSubmitting,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState(initialForm(item));
  const [errors, setErrors] = useState({});
  const [lastItem, setLastItem] = useState(item);
  const displayedItem = item ?? lastItem;
  const isPayable = displayedItem?.type === "payable";
  const isRecurring = Boolean(
    displayedItem && displayedItem.recurrence !== "none",
  );
  const contacts = isPayable ? suppliers : customers;
  const originalContactId =
    displayedItem?.supplier_id ?? displayedItem?.customer_id ?? "";
  const originalContactName =
    displayedItem?.supplier_name ?? displayedItem?.customer_name;
  const contactOptions = [
    { value: "", label: "Sem vínculo (Outros)" },
    ...contacts.map((contact) => ({ value: contact.id, label: contact.name })),
    ...(originalContactId &&
    !contacts.some((contact) => contact.id === originalContactId)
      ? [
          {
            value: originalContactId,
            label: `${originalContactName ?? "Cadastro"} (inativo)`,
          },
        ]
      : []),
  ];

  useLayoutEffect(() => {
    if (!item) {
      return;
    }
    setLastItem(item);
    setForm(initialForm(item));
    setErrors({});
  }, [item]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function submit() {
    const nextErrors = {};
    const amount = normalizeAmount(form.amount);
    const numericAmount = Number(amount);
    const dueDate = parseDate(form.date);

    if (!form.description.trim()) {
      nextErrors.description = "Informe uma descrição.";
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = "Informe um valor maior que zero.";
    }
    if (!dueDate) {
      nextErrors.date = "Informe uma data válida.";
    }
    if (!form.category) {
      nextErrors.category = "Selecione uma categoria.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount,
      due_date: dueDate,
      category: form.category,
      notes: form.notes.trim(),
    };
    if (form.counterpartyId !== originalContactId) {
      payload[isPayable ? "supplier_id" : "customer_id"] =
        form.counterpartyId || null;
    }
    onSave(displayedItem, payload);
  }

  return (
    <Modal
      visible={Boolean(item)}
      animationType="slide"
      transparent
      onRequestClose={() => !isSubmitting && onClose()}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="bg-white rounded-t-3xl max-h-[92%]">
          <View className="flex-row items-start justify-between px-5 pt-5 pb-3">
            <View className="flex-1 pr-4">
              <Text className="font-poppins-semibold text-xl text-texto-primario">
                Editar compromisso
              </Text>
              <Text className="font-poppins-regular text-sm text-texto-terciario">
                {isPayable ? "Conta a pagar" : "Conta a receber"}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <X size={24} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingBottom: 36, gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            {isRecurring ? (
              <View className="rounded-xl bg-blue-50 px-4 py-3">
                <Text className="font-poppins-regular text-xs text-blue-700">
                  Esta edição altera somente esta ocorrência da série {displayedItem?.recurrence_label?.toLocaleLowerCase("pt-BR") ?? "recorrente"}.
                </Text>
              </View>
            ) : null}
            <InputText
              label="Descrição"
              placeholder="Descrição do compromisso"
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
              label="Vencimento"
              placeholder="DD/MM/AAAA"
              value={form.date}
              onChangeText={(value) =>
                updateForm("date", formatDateInput(value))
              }
              error={errors.date}
              required
            />
            <SelectField
              label="Categoria"
              options={isPayable ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES}
              value={form.category}
              onChange={(value) => updateForm("category", value)}
              placeholder="Selecione uma categoria"
              error={errors.category}
              required
            />
            <SearchableSelectField
              label={`${isPayable ? "Fornecedor" : "Cliente"} (opcional)`}
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

            <View className="flex-row gap-3 pt-1">
              <Pressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-red-300 p-4 active:bg-red-50"
                onPress={() => onDelete(displayedItem)}
                disabled={isSubmitting}
              >
                <Trash2 size={18} color="#b91c1c" />
                <Text className="font-poppins-semibold text-red-700">
                  Excluir
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-azul-primario p-4 active:opacity-80"
                onPress={submit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Pencil size={18} color="#ffffff" />
                )}
                <Text className="font-poppins-semibold text-white">
                  Salvar
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
