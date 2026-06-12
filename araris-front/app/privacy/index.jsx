import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";

export default function Privacy() {
  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="font-poppins-semibold text-azul-primario">
              Voltar
            </Text>
          </Pressable>

          <Text className="font-poppins-semibold text-3xl text-texto-primario">
            Privacidade e dados
          </Text>

          <Text className="font-poppins-regular text-texto-secundario leading-6">
            O Araris usa os dados informados no cadastro para criar sua conta,
            identificar sua empresa e oferecer recursos de gestão financeira,
            tributária, alertas e notificações.
          </Text>

          <Text className="font-poppins-regular text-texto-secundario leading-6">
            Podemos armazenar informações como nome, e-mail, telefone, CNPJ,
            endereço da empresa, saldo inicial e preferências de uso. Esses
            dados ajudam a manter sua sessão, personalizar a experiência e
            permitir que o sistema apresente informações relevantes para o seu
            negócio.
          </Text>

          <Text className="font-poppins-regular text-texto-secundario leading-6">
            Também podemos registrar eventos técnicos, como tentativas de login,
            chamadas a serviços externos e envio de notificações. Esses registros
            são usados para segurança, diagnóstico de falhas e melhoria do
            serviço.
          </Text>

          <Text className="font-poppins-regular text-texto-secundario leading-6">
            Não vendemos seus dados pessoais. O acesso às informações deve ser
            limitado ao necessário para operar a plataforma, cumprir obrigações
            legais e proteger sua conta.
          </Text>

          <Text className="font-poppins-regular text-texto-secundario leading-6">
            Você poderá solicitar correção, atualização ou exclusão de dados,
            observadas regras legais de retenção e segurança.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
