import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";
import Button from "../../components/Button";
import InputText from "../../components/InputText";
import { login } from "../../services/authService";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AcessarConta() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleEmailBlur() {
    if (email && !EMAIL_REGEX.test(email)) {
      setEmailError("Insira um e-mail válido (ex: usuario@email.com)");
    } else {
      setEmailError("");
    }
  }

  async function handleLogin() {
    const nextEmailError =
      !email.trim() || !EMAIL_REGEX.test(email)
        ? "Insira um e-mail válido (ex: usuario@email.com)"
        : "";
    const nextPasswordError = !password ? "Informe sua senha." : "";

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError("");

    if (nextEmailError || nextPasswordError) {
      return;
    }

    try {
      setIsLoading(true);
      await login({ email, password });
      router.replace("/(tabs)/home");
    } catch (error) {
      setFormError(error.message || "Não foi possível acessar sua conta.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-azul-primario">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView className="flex-1 justify-between">
          <Image
            source={require("../../assets/images/logo_branco.png")}
            className="self-center w-[60%] mt-[5%] h-[15%]"
            resizeMode="contain"
          />
          <View className="bg-white rounded-t-[50px] absolute bottom-0 left-0 right-0  h-[80%] justify-around pb-4">
            <Text className="text-2xl pl-12 pt-10 font-poppins-semibold text-texto-primario">
              Acesse sua conta
            </Text>
            <View className="gap-6">
              <View className="w-[85%] self-center gap-6">
                <InputText
                  label="E-mail"
                  required
                  placeholder="usuario@email.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError("");
                  }}
                  secureTextEntry={false}
                  onBlur={handleEmailBlur}
                  error={emailError}
                />
                <InputText
                  label="Senha"
                  required
                  placeholder="•••••••••••••"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError("");
                    setFormError("");
                  }}
                  secureTextEntry={true}
                  error={passwordError}
                />
              </View>

              {formError ? (
                <Text className="px-12 text-sm font-poppins-medium text-red-500">
                  {formError}
                </Text>
              ) : null}

              <Text className="text-left pl-12 text-sm font-poppins-medium text-azul-primario">
                Esqueceu sua senha?
              </Text>
              {isLoading ? (
                <ActivityIndicator size="small" color="#0063f5" />
              ) : (
                <Button title="Entrar" onPress={handleLogin} isPrimary={true} />
              )}
            </View>
            <Text className="text-center font-poppins-medium text-texto-secundario">
              Não possui conta?{" "}
              <Text onPress={() => router.replace("/register")} className="text-azul-primario">
                Se Cadastre
              </Text>
            </Text>
            <View className="h-[1px] w-[90%] self-center bg-gray-300" />
            <Pressable className="p-4 w-[20%] self-center items-center justify-center rounded-xl active:bg-gray-200/50 border border-gray-200">
              <Image
                source={require("../../assets/images/google.png")}
                className="w-10 h-10 self-center"
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
