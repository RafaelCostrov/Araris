import { useState } from "react";
import { Pressable, View, Text, TextInput } from "react-native";
import { Eye, EyeOff, LockKeyhole } from "lucide-react-native";

export default function InputText({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  onBlur,
  error,
  required,
  editable = true,
  ...props
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const shouldShowPasswordToggle = Boolean(secureTextEntry);
  const isLocked = editable === false;

  return (
    <View className="gap-1">
      <Text
        className={`font-poppins-medium text-lg ${
          isLocked ? "text-gray-500" : "text-texto-secundario"
        }`}
      >
        {label}
        {required ? <Text className="text-red-400"> *</Text> : null}
      </Text>
      <View>
        <TextInput
          className={`rounded-lg border p-2 font-poppins-regular ${
            isLocked
              ? "border-gray-300 bg-gray-200 pr-12 text-gray-500"
              : `bg-gray-100 text-texto-primario ${
                  error ? "border-red-500" : "border-transparent"
                } ${shouldShowPasswordToggle ? "pr-12" : ""}`
          }`}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onBlur={onBlur}
          editable={editable}
          accessibilityState={{ disabled: isLocked }}
          {...props}
        />
        {isLocked ? (
          <View className="absolute right-3 top-2.5">
            <LockKeyhole size={19} color="#6b7280" />
          </View>
        ) : shouldShowPasswordToggle ? (
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
