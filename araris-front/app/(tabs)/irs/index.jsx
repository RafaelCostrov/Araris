import { Image, Text, View } from "react-native";

export default function IRS() {
  return (
    <View className="flex-1 bg-[#f9fafb] px-6">
      <View className="flex-1 items-center justify-center pb-16">
        <Image
          source={require("../../../assets/images/araris_construcao.png")}
          className="h-[250px] w-[180px]"
          resizeMode="contain"
        />

        <Text className="mt-6 text-center font-poppins-semibold text-[22px] text-texto-primario">
          Controle do DAS
        </Text>
        <Text className="mt-2 text-center font-poppins-medium text-base text-texto-primario">
          Esta área está em implementação
        </Text>
        <Text className="mt-2 max-w-[310px] text-center font-poppins-regular text-sm leading-5 text-texto-terciario">
          Em breve, você poderá acompanhar suas guias e obrigações do MEI por
          aqui.
        </Text>
      </View>
    </View>
  );
}
