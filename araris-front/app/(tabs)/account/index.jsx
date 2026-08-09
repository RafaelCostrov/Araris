import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ArrowLeft, CheckCircle2, User } from "lucide-react-native";

import Card from "../../../components/Card";
import InputText from "../../../components/InputText";
import { useAuth } from "../../../contexts/AuthContext";
import { updateMe } from "../../../services/authService";


function formatPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}


export default function Account() {
  const router = useRouter();
  const { loadSession, updateSessionUser, user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: formatPhone(user?.phone),
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name ?? "",
      phone: formatPhone(user?.phone),
    });
  }, [user]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSubmitError("");
    setSuccessMessage("");
  }

  async function saveProfile() {
    const nextErrors = {};
    const name = form.name.trim().replace(/\s+/g, " ");
    const phone = form.phone.replace(/\D/g, "");

    if (!name) {
      nextErrors.name = "Informe seu nome.";
    }
    if (phone && ![10, 11].includes(phone.length)) {
      nextErrors.phone = "Informe um telefone com DDD válido.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSuccessMessage("");
      const response = await updateMe({ name, phone });
      updateSessionUser(response.user);
      setSuccessMessage("Dados pessoais atualizados.");
    } catch (error) {
      if (error.status === 401) {
        await loadSession();
        return;
      }
      setSubmitError(
        error.message || "Não foi possível atualizar seus dados.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          className="mb-5 self-start flex-row items-center gap-2 py-1"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ArrowLeft size={20} color="#0063f5" />
          <Text className="font-poppins-semibold text-azul-primario">
            Voltar
          </Text>
        </Pressable>

        <Text className="font-poppins-semibold text-2xl text-texto-primario">
          Conta
        </Text>
        <Text className="mb-5 font-poppins-regular text-sm text-texto-terciario">
          Consulte e atualize seus dados pessoais.
        </Text>

        <Card className="mb-4 items-center gap-2 py-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <User size={38} color="#0063f5" />
          </View>
          <Text className="mt-1 font-poppins-semibold text-lg text-texto-primario">
            {user?.name}
          </Text>
          <Text className="font-poppins-regular text-sm text-texto-terciario">
            {user?.email}
          </Text>
        </Card>

        <Card className="gap-6">
          <View>
            <Text className="font-poppins-semibold text-lg text-texto-primario">
              Dados pessoais
            </Text>
            <Text className="font-poppins-regular text-xs text-texto-terciario">
              Essas informações identificam você dentro do Araris.
            </Text>
          </View>

          <InputText
            label="Nome completo"
            placeholder="Seu nome"
            value={form.name}
            onChangeText={(value) => updateForm("name", value)}
            error={errors.name}
            autoCapitalize="words"
            required
          />

          <InputText
            label="E-mail"
            value={user?.email ?? ""}
            editable={false}
          />

          <InputText
            label="Telefone"
            placeholder="(00) 00000-0000"
            value={form.phone}
            onChangeText={(value) => updateForm("phone", formatPhone(value))}
            error={errors.phone}
            keyboardType="phone-pad"
          />

          {submitError ? (
            <Text className="font-poppins-medium text-sm text-red-600">
              {submitError}
            </Text>
          ) : null}

          {successMessage ? (
            <View className="flex-row items-center gap-2 rounded-xl bg-green-50 px-3 py-2">
              <CheckCircle2 size={17} color="#15803d" />
              <Text className="font-poppins-medium text-sm text-green-700">
                {successMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            className="items-center rounded-xl bg-azul-primario p-4 active:opacity-80"
            onPress={saveProfile}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Salvar dados pessoais"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-poppins-semibold text-white">
                Salvar alterações
              </Text>
            )}
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
