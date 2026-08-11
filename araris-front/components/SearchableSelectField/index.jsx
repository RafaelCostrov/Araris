import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Check, Search, X } from "lucide-react-native";


function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}


export default function SearchableSelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
  emptyMessage = "Nenhum cadastro encontrado.",
  error,
  required,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) {
      setQuery(value ? selectedOption?.label ?? "" : "");
    }
  }, [isOpen, selectedOption?.label, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) {
      return options.slice(0, 8);
    }
    return options
      .filter((option) =>
        normalizeSearch(option.label).includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [options, query]);

  function handleQueryChange(nextQuery) {
    setQuery(nextQuery);
    setIsOpen(true);
    if (value) {
      onChange("");
    }
  }

  function handleSelect(option) {
    Keyboard.dismiss();
    onChange(option.value);
    setQuery(option.value ? option.label : "");
    setIsOpen(false);
  }

  function clearSelection() {
    onChange("");
    setQuery("");
    setIsOpen(true);
  }

  return (
    <View className="gap-1">
      <Text className="font-poppins-medium text-texto-secundario text-lg">
        {label}
        {required ? <Text className="text-red-400"> *</Text> : null}
      </Text>

      <View>
        <View
          className={`bg-gray-100 rounded-lg border flex-row items-center px-3 ${
            error ? "border-red-500" : "border-transparent"
          }`}
        >
          <Search size={18} color="#6b7280" />
          <TextInput
            className="flex-1 py-3 px-2 font-poppins-regular text-texto-primario"
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setIsOpen(true)}
            autoCorrect={false}
            selectTextOnFocus
          />
          {query ? (
            <Pressable hitSlop={8} onPress={clearSelection}>
              <X size={17} color="#6b7280" />
            </Pressable>
          ) : null}
        </View>

        {isOpen ? (
          <View className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value || "empty-option"}
                    className={`flex-row items-center justify-between px-3 py-3 border-b border-gray-100 last:border-b-0 ${
                      isSelected ? "bg-blue-50" : "bg-white"
                    }`}
                    onPress={() => handleSelect(option)}
                  >
                    <Text
                      className="flex-1 font-poppins-regular text-texto-primario"
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? <Check size={18} color="#0063f5" /> : null}
                  </Pressable>
                );
              })
            ) : (
              <Text className="px-3 py-4 text-center font-poppins-regular text-sm text-texto-terciario">
                {emptyMessage}
              </Text>
            )}
          </View>
        ) : null}

        {error ? (
          <Text className="mt-1 text-xs font-poppins-regular text-red-500">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
