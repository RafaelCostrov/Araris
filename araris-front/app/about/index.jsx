import { router } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../../global.css";

export default function About() {
  return (
    <View className="flex-1 bg-azul-primario">
      <SafeAreaView className="flex-1 justify-between">
        <Image
          source={require("../../assets/images/logo_branco.png")}
          className="self-center w-[60%] mt-[5%] h-[15%]"
          resizeMode="contain"
        />

        <View className="bg-white rounded-t-[50px] absolute bottom-0 left-0 right-0 h-[82%]">
          <ScrollView
            className="flex-1 px-10 pt-12 pb-8"
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-6 mb-4">
              <View className="gap-3">
                <Text className="text-2xl font-poppins-semibold text-texto-primario">
                  Sobre nós
                </Text>
                <Text className="font-poppins-regular leading-6 text-texto-terciario">
                  O Araris é uma plataforma de gestão financeira criada para
                  Microempreendedores Individuais que querem organizar o negócio
                  com mais clareza, praticidade e inteligência.
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-lg font-poppins-semibold text-texto-primario">
                  Nossa proposta
                </Text>
                <Text className="font-poppins-regular leading-6 text-texto-terciario">
                  Reunir em um só lugar tudo o que um MEI precisa para
                  acompanhar receitas, despesas, compromissos financeiros e
                  tomar decisões melhores sobre o futuro da empresa.
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-lg font-poppins-semibold text-texto-primario">
                  O que o Araris oferece
                </Text>
                <Text className="font-poppins-regular leading-6 text-texto-terciario">
                  Controle de entradas e saídas, gestão de clientes e
                  fornecedores, acompanhamento do DAS, alertas inteligentes,
                  monitoramento do limite anual de faturamento, previsões
                  financeiras com IA, chatbot para consultas em linguagem
                  natural, armazenamento de documentos e suporte para múltiplos
                  usuários na mesma conta.
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-lg font-poppins-semibold text-texto-primario">
                  Para quem foi pensado
                </Text>
                <Text className="font-poppins-regular leading-6 text-texto-terciario">
                  Para MEIs brasileiros que querem sair das planilhas soltas e
                  passar a enxergar a saúde financeira do negócio de forma
                  simples, organizada e acessível.
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-lg font-poppins-semibold text-texto-primario">
                  Modelo de uso
                </Text>
                <Text className="font-poppins-regular leading-6 text-texto-terciario">
                  O Araris segue o modelo SaaS, com uma experiência inicial
                  gratuita e recursos avançados liberados em um plano premium,
                  como previsões por inteligência artificial e um chatbot mais
                  completo.
                </Text>
              </View>

              <View className="gap-2 rounded-2xl bg-gray-100 p-4">
                <Text className="font-poppins-regular leading-6 text-sm text-texto-terciario">
                  Desenvolvido por Rafael Costrov em 2026
                </Text>
              </View>
              <Text
                onPress={() => router.back()}
                className="pt-2 mb-6 font-poppins-medium text-azul-primario"
              >
                Voltar
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
