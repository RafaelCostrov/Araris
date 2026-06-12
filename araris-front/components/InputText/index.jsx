import { useState } from "react";
import { Pressable, View, Text, TextInput } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

export default function InputText({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  onBlur,
  error,
  required,
  ...props
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const shouldShowPasswordToggle = Boolean(secureTextEntry);

  return (
    <View className="gap-1">
      <Text className="font-poppins-medium text-texto-secundario text-lg">
        {label}
        {required ? <Text className="text-red-400"> *</Text> : null}
      </Text>
      <View>
        <TextInput
          className={`bg-gray-100 rounded-lg p-2 font-poppins-regular text-texto-primario border ${
            error ? "border-red-500" : "border-transparent"
          } ${shouldShowPasswordToggle ? "pr-12" : ""}`}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onBlur={onBlur}
          {...props}
        />
        {shouldShowPasswordToggle ? (
          <Pressable
            className="absolute right-3 top-2.5"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((current) => !current)}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color="#6b7280" />
            ) : (
              <Eye size={20} color="#6b7280" />
            )}
          </Pressable>
        ) : null}
        {error ? (
          <Text className="absolute -bottom-4 left-1 text-red-500 text-xs font-poppins-regular">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
