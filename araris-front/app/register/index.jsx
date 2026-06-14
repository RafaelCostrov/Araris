import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";
import Button from "../../components/Button";
import InputText from "../../components/InputText";
import SelectField from "../../components/SelectField";
import { BUSINESS_CATEGORIES } from "../../constants/businessCategories";
import { useAuth } from "../../contexts/AuthContext";
import {
  checkCnpjAvailability,
  checkEmailAvailability,
  googleRegister,
  register,
} from "../../services/authService";
import { getGoogleIdentity } from "../../services/googleAuthService";
import { lookupCep, lookupCnpj } from "../../services/integrationService";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOTAL_STEPS = 4;

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  let length = 12;
  let numbers = digits.slice(0, length);
  let sum = 0;
  let pos = length - 7;

  for (let index = length; index >= 1; index -= 1) {
    sum += Number(numbers[length - index]) * pos;
    pos -= 1;

    if (pos < 2) {
      pos = 9;
    }
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  if (result !== Number(digits[12])) {
    return false;
  }

  length = 13;
  numbers = digits.slice(0, length);
  sum = 0;
  pos = length - 7;

  for (let index = length; index >= 1; index -= 1) {
    sum += Number(numbers[length - index]) * pos;
    pos -= 1;

    if (pos < 2) {
      pos = 9;
    }
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);

  return result === Number(digits[13]);
}

function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function formatBalance(value) {
  return onlyDigits(value).slice(0, 12);
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirm: "",
  authMethod: "email",
  googleIdToken: "",
  acceptedLgpd: false,
  businessName: "",
  tradeName: "",
  cnpj: "",
  cep: "",
  street: "",
  number: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
  cnaeCode: "",
  cnaeDescription: "",
  meiOptIn: null,
  registrationStatus: "",
  initialBalance: "",
  companyCategory: "",
};

const stepLabels = [
  "Forma de cadastro",
  "Informações básicas",
  "CNPJ e localização",
  "Informações da empresa",
];

export default function Register() {
  const { loadSession } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: "" }));
    setSubmitError("");
  }

  function handleEmailRegisterChoice() {
    setForm((currentForm) => ({
      ...currentForm,
      authMethod: "email",
      googleIdToken: "",
    }));
    setCurrentStep(1);
  }

  async function handleGoogleRegisterChoice() {
    try {
      setIsGoogleLoading(true);
      setSubmitError("");
      const googleIdentity = await getGoogleIdentity();

      if (!googleIdentity) {
        return;
      }

      setForm((currentForm) => ({
        ...currentForm,
        authMethod: "google",
        googleIdToken: googleIdentity.idToken,
        name: googleIdentity.user?.name || currentForm.name,
        email: googleIdentity.user?.email || currentForm.email,
      }));
      setCurrentStep(2);
    } catch (error) {
      Alert.alert(
        "Cadastro com Google",
        error.message || "Não foi possível iniciar o cadastro com Google.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  }

  function handlePreviousStep() {
    if (form.authMethod === "google" && currentStep === 2) {
      setCurrentStep(0);
      return;
    }

    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function checkEmail() {
    const email = form.email.trim();

    if (!email) {
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        email: "Insira um e-mail válido (ex: usuario@email.com)",
      }));
      return false;
    }

    try {
      const data = await checkEmailAvailability(email);

      if (!data.available) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          email: "Já existe um usuário com este e-mail.",
        }));
        return false;
      }

      setErrors((currentErrors) => ({ ...currentErrors, email: "" }));
      return true;
    } catch {
      return true;
    }
  }

  async function handleEmailBlur() {
    await checkEmail();
  }

  async function fillCompanyFromCnpj() {
    try {
      const company = await lookupCnpj(form.cnpj);
      const companyNumber = onlyDigits(company.number);

      setForm((currentForm) => ({
        ...currentForm,
        businessName: company.business_name || currentForm.businessName,
        tradeName: company.trade_name || currentForm.tradeName,
        cep: company.postal_code
          ? formatCep(company.postal_code)
          : currentForm.cep,
        street: company.street || currentForm.street,
        number: companyNumber || currentForm.number,
        addressComplement:
          company.address_complement || currentForm.addressComplement,
        neighborhood: company.neighborhood || currentForm.neighborhood,
        city: company.city || currentForm.city,
        state: company.state || currentForm.state,
        cnaeCode: company.cnae_code || currentForm.cnaeCode,
        cnaeDescription: company.cnae_description || currentForm.cnaeDescription,
        meiOptIn:
          typeof company.mei_opt_in === "boolean"
            ? company.mei_opt_in
            : currentForm.meiOptIn,
        registrationStatus:
          company.registration_status || currentForm.registrationStatus,
      }));
    } catch {
      return;
    }
  }

  async function checkCnpj() {
    if (!form.cnpj.trim()) {
      return false;
    }

    if (!isValidCnpj(form.cnpj)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        cnpj: "Insira um CNPJ válido (ex: 12.345.678/0001-90)",
      }));
      return false;
    }

    try {
      const data = await checkCnpjAvailability(form.cnpj);

      if (!data.available) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          cnpj: "Já existe uma empresa com este CNPJ.",
        }));
        return false;
      }

      setErrors((currentErrors) => ({ ...currentErrors, cnpj: "" }));
      await fillCompanyFromCnpj();
      return true;
    } catch {
      return true;
    }
  }

  async function handleCnpjBlur() {
    await checkCnpj();
  }

  async function handleCepBlur() {
    const cepDigits = onlyDigits(form.cep);

    if (!cepDigits) {
      return;
    }

    if (cepDigits.length !== 8) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        cep: "Insira um CEP válido (ex: 12345-678)",
      }));
      return;
    }

    setErrors((currentErrors) => ({ ...currentErrors, cep: "" }));

    try {
      const data = await lookupCep(cepDigits);

      setForm((currentForm) => ({
        ...currentForm,
        cep: formatCep(cepDigits),
        addressComplement:
          data.address_complement || currentForm.addressComplement,
        street: data.street || currentForm.street,
        neighborhood: data.neighborhood || currentForm.neighborhood,
        city: data.city || currentForm.city,
        state: data.state || currentForm.state,
      }));
    } catch (error) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        cep: error.message || "Não foi possível consultar o CEP agora.",
      }));
    }
  }

  async function validateCurrentStep() {
    const nextErrors = {};

    if (currentStep === 1) {
      if (!form.name.trim()) {
        nextErrors.name = "Informe seu nome.";
      }

      if (!form.email.trim()) {
        nextErrors.email = "Informe seu e-mail.";
      } else if (!EMAIL_REGEX.test(form.email)) {
        nextErrors.email = "Insira um e-mail válido (ex: usuario@email.com)";
      }

      if (!form.phone.trim()) {
        nextErrors.phone = "Informe seu telefone.";
      }

      if (!form.password) {
        nextErrors.password = "Informe uma senha.";
      } else if (form.password.length < 8) {
        nextErrors.password = "Use pelo menos 8 caracteres.";
      }

      if (!form.passwordConfirm) {
        nextErrors.passwordConfirm = "Confirme sua senha.";
      } else if (form.password !== form.passwordConfirm) {
        nextErrors.passwordConfirm = "As senhas não conferem.";
      }

    }

    if (currentStep === 2) {
      if (!form.cnpj.trim()) {
        nextErrors.cnpj = "Informe o CNPJ.";
      } else if (!isValidCnpj(form.cnpj)) {
        nextErrors.cnpj = "Insira um CNPJ válido (ex: 12.345.678/0001-90)";
      }

      const cepDigits = onlyDigits(form.cep);

      if (!cepDigits) {
        nextErrors.cep = "Informe o CEP.";
      } else if (cepDigits.length !== 8) {
        nextErrors.cep = "Insira um CEP válido (ex: 12345-678)";
      }

      if (!form.street.trim()) {
        nextErrors.street = "Informe a rua.";
      }

      if (!form.neighborhood.trim()) {
        nextErrors.neighborhood = "Informe o bairro.";
      }

      if (!form.city.trim()) {
        nextErrors.city = "Informe a cidade.";
      }

      if (!form.state.trim()) {
        nextErrors.state = "Informe o estado.";
      }
    }

    if (currentStep === 3) {
      if (!form.businessName.trim()) {
        nextErrors.businessName = "Informe o nome da empresa.";
      }

      if (!form.initialBalance.trim()) {
        nextErrors.initialBalance = "Informe o saldo inicial.";
      }

      if (!form.companyCategory.trim()) {
        nextErrors.companyCategory = "Informe a categoria da empresa.";
      }

      if (!form.acceptedLgpd) {
        nextErrors.acceptedLgpd = "Você precisa aceitar os termos de privacidade.";
      }
    }

    setErrors((currentErrors) => ({ ...currentErrors, ...nextErrors }));
    if (Object.keys(nextErrors).length > 0) {
      return false;
    }

    if (currentStep === 1) {
      return checkEmail();
    }

    if (currentStep === 2) {
      return checkCnpj();
    }

    return true;
  }

  async function handleNextStep() {
    if (!(await validateCurrentStep())) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, TOTAL_STEPS - 1));
  }

  async function handleSubmit() {
    if (!(await validateCurrentStep())) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      if (form.authMethod === "google") {
        await googleRegister(form);
      } else {
        await register(form);
      }
      const session = await loadSession();

      if (!session?.user) {
        throw new Error("Não foi possível carregar os dados da sessão.");
      }

      router.replace("/(tabs)/home");
    } catch (error) {
      setSubmitError(error.message || "Não foi possível criar sua conta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View className="absolute top-0 left-0 right-0 h-[35%] bg-azul-primario" />
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

          <View className="bg-white rounded-t-[50px] absolute bottom-0 left-0 right-0 h-[84%] overflow-hidden">
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 64 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <View className="px-10 pt-10 gap-6">
              <View className="gap-3">
                <Text className="text-2xl font-poppins-semibold text-texto-primario">
                  Crie sua conta
                </Text>
                <Text className="font-poppins-regular text-texto-terciario">
                  Etapa {currentStep + 1} de {TOTAL_STEPS}:{" "}
                  {stepLabels[currentStep]}
                </Text>
                <View className="flex-row gap-2">
                  {stepLabels.map((label, index) => (
                    <View
                      key={label}
                      className={`h-2 flex-1 rounded-full ${
                        index <= currentStep
                          ? "bg-azul-primario"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </View>
              </View>

              <View className="gap-6">
                {currentStep === 0 ? (
                  <View className="gap-4">
                    <Pressable
                      className="flex-row items-center gap-4 rounded-2xl border border-gray-200 px-4 py-4 active:bg-gray-100"
                      onPress={handleGoogleRegisterChoice}
                      disabled={isGoogleLoading}
                    >
                      <Image
                        source={require("../../assets/images/google.png")}
                        className="w-9 h-9"
                        resizeMode="contain"
                      />
                      <View className="flex-1">
                        <Text className="font-poppins-semibold text-texto-primario">
                          Continuar com Google
                        </Text>
                        <Text className="font-poppins-regular text-sm text-texto-terciario">
                          Use sua conta Google para entrar no Araris.
                        </Text>
                      </View>
                      {isGoogleLoading ? (
                        <ActivityIndicator size="small" color="#0063f5" />
                      ) : null}
                    </Pressable>

                    <Pressable
                      className="rounded-2xl border border-gray-200 px-4 py-4 active:bg-gray-100"
                      onPress={handleEmailRegisterChoice}
                    >
                      <Text className="font-poppins-semibold text-texto-primario">
                        Continuar com e-mail
                      </Text>
                      <Text className="font-poppins-regular text-sm text-texto-terciario">
                        Crie sua conta preenchendo os dados do formulário.
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {currentStep === 1 ? (
                  <>
                    <InputText
                      label="Nome completo"
                      required
                      placeholder="Como devemos te chamar?"
                      value={form.name}
                      onChangeText={(text) => updateField("name", text)}
                      secureTextEntry={false}
                      autoCapitalize="words"
                      error={errors.name}
                    />
                    <InputText
                      label="E-mail"
                      required
                      placeholder="usuario@email.com"
                      value={form.email}
                      onChangeText={(text) => updateField("email", text)}
                      secureTextEntry={false}
                      onBlur={handleEmailBlur}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      error={errors.email}
                    />
                    <InputText
                      label="Telefone"
                      required
                      placeholder="(11) 99999-9999"
                      value={form.phone}
                      onChangeText={(text) =>
                        updateField("phone", formatPhone(text))
                      }
                      secureTextEntry={false}
                      keyboardType="phone-pad"
                      error={errors.phone}
                    />
                    <InputText
                      label="Senha"
                      required
                      placeholder="Crie uma senha segura"
                      value={form.password}
                      onChangeText={(text) => updateField("password", text)}
                      secureTextEntry={true}
                      error={errors.password}
                    />
                    <InputText
                      label="Confirmar senha"
                      required
                      placeholder="Repita sua senha"
                      value={form.passwordConfirm}
                      onChangeText={(text) =>
                        updateField("passwordConfirm", text)
                      }
                      secureTextEntry={true}
                      error={errors.passwordConfirm}
                    />
                  </>
                  
                ) : null}

                {currentStep === 2 ? (
                  <>
                    <InputText
                      label="CNPJ"
                      required
                      placeholder="12.345.678/0001-90"
                      value={form.cnpj}
                      onChangeText={(text) =>
                        updateField("cnpj", formatCnpj(text))
                      }
                      secureTextEntry={false}
                      onBlur={handleCnpjBlur}
                      keyboardType="number-pad"
                      error={errors.cnpj}
                    />

                    <View className="gap-2">
                      <InputText
                        label="CEP"
                        required
                        placeholder="12345-678"
                        value={form.cep}
                        onChangeText={(text) =>
                          updateField("cep", formatCep(text))
                        }
                        secureTextEntry={false}
                        onBlur={handleCepBlur}
                        keyboardType="number-pad"
                        error={errors.cep}
                      />
                    </View>

                    <InputText
                      label="Rua"
                      required
                      placeholder="Rua, avenida, travessa..."
                      value={form.street}
                      onChangeText={(text) => updateField("street", text)}
                      secureTextEntry={false}
                      error={errors.street}
                    />
                    <InputText
                      label="Número"
                      placeholder="Ex: 123"
                      value={form.number}
                      onChangeText={(text) =>
                        updateField("number", onlyDigits(text))
                      }
                      secureTextEntry={false}
                      keyboardType="number-pad"
                    />
                    <InputText
                      label="Bairro"
                      required
                      placeholder="Seu bairro"
                      value={form.neighborhood}
                      onChangeText={(text) => updateField("neighborhood", text)}
                      secureTextEntry={false}
                      error={errors.neighborhood}
                    />
                    <InputText
                      label="Cidade"
                      required
                      placeholder="Sua cidade"
                      value={form.city}
                      onChangeText={(text) => updateField("city", text)}
                      secureTextEntry={false}
                      error={errors.city}
                    />
                    <InputText
                      label="UF"
                      required
                      placeholder="Ex: SP"
                      value={form.state}
                      onChangeText={(text) =>
                        updateField("state", text.toUpperCase())
                      }
                      secureTextEntry={false}
                      autoCapitalize="characters"
                      maxLength={2}
                      error={errors.state}
                    />
                  </>
                ) : null}

                {currentStep === 3 ? (
                  <>
                    <InputText
                      label="Nome da empresa"
                      required
                      placeholder="Nome fantasia ou razão social"
                      value={form.businessName}
                      onChangeText={(text) => updateField("businessName", text)}
                      secureTextEntry={false}
                      error={errors.businessName}
                    />
                    <InputText
                      label="Saldo inicial"
                      required
                      placeholder="Ex: 15000"
                      value={form.initialBalance}
                      onChangeText={(text) =>
                        updateField("initialBalance", formatBalance(text))
                      }
                      secureTextEntry={false}
                      keyboardType="decimal-pad"
                      error={errors.initialBalance}
                    />
                    <SelectField
                      label="Categoria da empresa"
                      required
                      placeholder="Selecione uma categoria"
                      options={BUSINESS_CATEGORIES}
                      value={form.companyCategory}
                      onChange={(text) =>
                        updateField("companyCategory", text)
                      }
                      error={errors.companyCategory}
                    />
                    <Pressable
                      className="flex-row items-start gap-3"
                      onPress={() =>
                        updateField("acceptedLgpd", !form.acceptedLgpd)
                      }
                    >
                      <View
                        className={`h-5 w-5 rounded border items-center justify-center mt-1 ${
                          form.acceptedLgpd
                            ? "bg-azul-primario border-azul-primario"
                            : "bg-white border-gray-400"
                        }`}
                      >
                        {form.acceptedLgpd ? (
                          <Text className="text-white text-xs font-poppins-semibold">
                            ✓
                          </Text>
                        ) : null}
                      </View>
                      <Text className="flex-1 font-poppins-regular text-texto-secundario">
                        Li e aceito os{" "}
                        <Text
                          className="text-azul-primario font-poppins-medium"
                          onPress={() => router.push("/privacy")}
                        >
                          termos de privacidade
                        </Text>{" "}
                        e tratamento de dados.
                      </Text>
                    </Pressable>
                    {errors.acceptedLgpd ? (
                      <Text className="text-red-500 text-xs font-poppins-regular">
                        {errors.acceptedLgpd}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>

              <View className="gap-3 pt-2">
                {submitError ? (
                  <Text className="text-center font-poppins-medium text-red-500">
                    {submitError}
                  </Text>
                ) : null}

                {currentStep === 0 ? null : currentStep < TOTAL_STEPS - 1 ? (
                  <Button
                    title="Continuar"
                    onPress={handleNextStep}
                    isPrimary={true}
                  />
                ) : isSubmitting ? (
                  <ActivityIndicator size="small" color="#0063f5" />
                ) : (
                  <Button
                    title="Criar conta"
                    onPress={handleSubmit}
                    isPrimary={true}
                  />
                )}

                {currentStep > 0 ? (
                  <Pressable
                    onPress={handlePreviousStep}
                  >
                    <Text className="text-center font-poppins-medium text-azul-primario">
                      Voltar para a etapa anterior
                    </Text>
                  </Pressable>
                ) : null}

                {currentStep === 0 ? (
                  <><Text className="text-center font-poppins-medium text-texto-secundario">
                Já possui conta?{" "}
                <Text
                  onPress={() => router.replace("/login")}
                  className="text-azul-primario"
                >
                  Acesse aqui
                </Text>
              </Text>
              <Text 
              onPress={() => router.push("/about")} 
              className="font-poppins-regular-italic text-azul-primario text-center text-sm">
                Conheça mais sobre nós
              </Text></>
                ) : null}
              </View>
            </View>
          </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
