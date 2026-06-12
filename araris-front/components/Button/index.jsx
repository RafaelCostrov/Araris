import { Pressable, Text } from "react-native";

export default function Button( {title, onPress, isPrimary} ) {

  return (
    <Pressable
      className={`p-3 w-[90%] self-center items-center justify-center rounded-lg 
        ${isPrimary ? "bg-azul-primario active:bg-azul-primario/90" : "bg-white active:bg-white/90"}`}
      onPress={onPress}
    >
      <Text className={`text-xl ${isPrimary ? "text-white" : "text-black"} font-poppins-medium`}>
        {title}
      </Text>
    </Pressable>
  );
}
