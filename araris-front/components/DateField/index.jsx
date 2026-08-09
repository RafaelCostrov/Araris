import { useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react-native";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

function parseValue(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? "");

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function sameDay(left, right) {
  return (
    left?.getFullYear() === right?.getFullYear() &&
    left?.getMonth() === right?.getMonth() &&
    left?.getDate() === right?.getDate()
  );
}

function monthCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function DateField({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  required,
  maximumDate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const selectedDate = parseValue(value);
  const maxDate = parseIsoDate(maximumDate);
  const cells = monthCells(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const nextMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    1,
  );
  const maxMonth = maxDate
    ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
    : null;
  const canGoNext = !maxMonth || nextMonth <= maxMonth;

  function openCalendar() {
    const baseDate = selectedDate ?? new Date();
    setVisibleMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setIsOpen(true);
  }

  function changeMonth(offset) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function selectDate(date) {
    if (maxDate && date > maxDate) {
      return;
    }

    onChangeText(formatDate(date));
    setIsOpen(false);
  }

  return (
    <View className="gap-1">
      <Text className="font-poppins-medium text-texto-secundario text-lg">
        {label}
        {required ? <Text className="text-red-400"> *</Text> : null}
      </Text>
      <View>
        <TextInput
          className={`bg-gray-100 rounded-lg p-2 pr-12 font-poppins-regular text-texto-primario border ${
            error ? "border-red-500" : "border-transparent"
          }`}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={10}
        />
        <Pressable
          className="absolute right-2 top-1.5 w-9 h-9 items-center justify-center rounded-lg active:bg-blue-100"
          hitSlop={6}
          onPress={openCalendar}
          accessibilityRole="button"
          accessibilityLabel="Abrir calendário"
        >
          <CalendarDays size={20} color="#0063f5" />
        </Pressable>
      </View>
      {error ? (
        <Text className="text-red-500 text-xs font-poppins-regular">
          {error}
        </Text>
      ) : null}

      <Modal
        visible={isOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-5"
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            className="bg-white rounded-3xl p-5"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="font-poppins-semibold text-xl text-texto-primario capitalize">
                  {monthLabel}
                </Text>
                <Text className="font-poppins-regular text-sm text-texto-terciario">
                  Escolha uma data
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setIsOpen(false)}>
                <X size={22} color="#6b7280" />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between mb-4">
              <Pressable
                className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
                onPress={() => changeMonth(-1)}
              >
                <ChevronLeft size={20} color="#343A40" />
              </Pressable>
              <Pressable
                className={`w-10 h-10 rounded-xl items-center justify-center ${
                  canGoNext ? "bg-gray-100 active:bg-gray-200" : "bg-gray-50"
                }`}
                onPress={() => changeMonth(1)}
                disabled={!canGoNext}
              >
                <ChevronRight size={20} color={canGoNext ? "#343A40" : "#d1d5db"} />
              </Pressable>
            </View>

            <View className="flex-row mb-2">
              {WEEKDAYS.map((weekday, index) => (
                <View key={`${weekday}-${index}`} style={{ width: "14.2857%" }}>
                  <Text className="font-poppins-semibold text-texto-terciario text-center text-xs">
                    {weekday}
                  </Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {cells.map((date, index) => {
                if (!date) {
                  return (
                    <View
                      key={`empty-${index}`}
                      className="h-11"
                      style={{ width: "14.2857%" }}
                    />
                  );
                }

                const isSelected = sameDay(date, selectedDate);
                const isToday = sameDay(date, new Date());
                const isDisabled = Boolean(maxDate && date > maxDate);

                return (
                  <View
                    key={date.toISOString()}
                    className="h-11 items-center justify-center"
                    style={{ width: "14.2857%" }}
                  >
                    <Pressable
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        isSelected
                          ? "bg-azul-primario"
                          : isToday
                            ? "border border-azul-primario"
                            : "active:bg-blue-50"
                      }`}
                      onPress={() => selectDate(date)}
                      disabled={isDisabled}
                    >
                      <Text
                        className={`font-poppins-medium text-sm ${
                          isSelected
                            ? "text-white"
                            : isDisabled
                              ? "text-gray-300"
                              : "text-texto-primario"
                        }`}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
