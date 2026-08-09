import { Building2 } from "lucide-react-native";
import { Text, View } from "react-native";


export default function OrganizationGreeting({ firstName, organizationName }) {
  return (
    <View>
      <Text className="text-base font-poppins-medium text-texto-terciario">
        Olá, {firstName}
      </Text>
      <View className="flex-row items-center gap-2">
        <Building2 size={17} color="#0063f5" />
        <Text
          className="flex-1 text-lg font-poppins-semibold text-texto-primario"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {organizationName || "Homepage"}
        </Text>
      </View>
    </View>
  );
}
