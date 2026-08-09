import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const SHORT_MONTHS = [
  "Jan.",
  "Fev.",
  "Mar.",
  "Abr.",
  "Mai.",
  "Jun.",
  "Jul.",
  "Ago.",
  "Set.",
  "Out.",
  "Nov.",
  "Dez.",
];

function parseMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthValue() {
  const today = new Date();
  return formatMonthValue(new Date(today.getFullYear(), today.getMonth(), 1));
}

function monthLabel(value) {
  const label = parseMonth(value).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortMonthLabel(value) {
  const date = parseMonth(value);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function MonthSelector({ value, onChange, variant = "default" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(parseMonth(value).getFullYear());
  const selectedDate = parseMonth(value);
  const isHeader = variant === "header";

  function openSelector() {
    setVisibleYear(selectedDate.getFullYear());
    setIsOpen(true);
  }

  function selectMonth(monthIndex) {
    onChange(formatMonthValue(new Date(visibleYear, monthIndex, 1)));
    setIsOpen(false);
  }

  function selectCurrentMonth() {
    onChange(currentMonthValue());
    setIsOpen(false);
  }

  return (
    <>
      <Pressable
        className={`h-9 px-2.5 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-70 ${
          isHeader
            ? "bg-transparent"
            : "bg-white border border-gray-200"
        }`}
        style={
          isHeader
            ? { borderWidth: 1, borderColor: "rgba(255,255,255,0.85)" }
            : undefined
        }
        onPress={openSelector}
        accessibilityRole="button"
        accessibilityLabel={`Escolher mês. Selecionado: ${monthLabel(value)}`}
      >
        <CalendarRange size={15} color={isHeader ? "#ffffff" : "#0063f5"} />
        <Text
          className={`font-poppins-semibold text-xs ${
            isHeader ? "text-white" : "text-texto-primario"
          }`}
        >
          {shortMonthLabel(value)}
        </Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-6"
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            className="bg-white rounded-3xl p-5"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-5">
              <Text className="font-poppins-semibold text-xl text-texto-primario">
                Escolher período
              </Text>
              <Pressable hitSlop={10} onPress={() => setIsOpen(false)}>
                <X size={22} color="#6b7280" />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between mb-5">
              <Pressable
                className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
                onPress={() => setVisibleYear((year) => year - 1)}
              >
                <ChevronLeft size={20} color="#343A40" />
              </Pressable>
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                {visibleYear}
              </Text>
              <Pressable
                className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
                onPress={() => setVisibleYear((year) => year + 1)}
              >
                <ChevronRight size={20} color="#343A40" />
              </Pressable>
            </View>

            <View className="flex-row flex-wrap gap-y-3">
              {MONTHS.map((month, index) => {
                const isSelected =
                  selectedDate.getFullYear() === visibleYear &&
                  selectedDate.getMonth() === index;

                return (
                  <View key={month} className="px-1" style={{ width: "33.3333%" }}>
                    <Pressable
                      className={`py-3 rounded-xl items-center ${
                        isSelected ? "bg-azul-primario" : "bg-gray-100"
                      }`}
                      onPress={() => selectMonth(index)}
                    >
                      <Text
                        className={`font-poppins-medium ${
                          isSelected ? "text-white" : "text-texto-primario"
                        }`}
                      >
                        {month}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Pressable
              className="mt-5 border border-azul-primario rounded-xl p-3 items-center"
              onPress={selectCurrentMonth}
            >
              <Text className="font-poppins-semibold text-azul-primario">
                Voltar para o mês atual
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
