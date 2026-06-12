import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";

export default function SelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  required,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <View className="gap-1">
      <Text className="font-poppins-medium text-texto-secundario text-lg">
        {label}
        {required ? <Text className="text-red-400"> *</Text> : null}
      </Text>

      <View>
        <Pressable
          className={`bg-gray-100 rounded-lg p-3 border flex-row items-center justify-between ${
            error ? "border-red-500" : "border-transparent"
          }`}
          onPress={() => setIsOpen((current) => !current)}
        >
          <Text
            className={`font-poppins-regular ${
              selectedOption ? "text-texto-primario" : "text-texto-terciario"
            }`}
          >
            {selectedOption?.label ?? placeholder}
          </Text>
          <ChevronDown size={18} color="#6b7280" />
        </Pressable>

        {isOpen ? (
          <View className="mt-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  className={`px-3 py-3 flex-row items-center justify-between ${
                    isSelected ? "bg-blue-50" : "bg-white"
                  }`}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text className="font-poppins-regular text-texto-primario">
                    {option.label}
                  </Text>
                  {isSelected ? <Check size={18} color="#0063f5" /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {error ? (
          <Text className="mt-1 text-red-500 text-xs font-poppins-regular">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
