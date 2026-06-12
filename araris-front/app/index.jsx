import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import "../global.css";
import Button from "../components/Button";
import { refreshSession } from "../services/authService";

export default function Index() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const tokens = await refreshSession();
        if (tokens && isMounted) {
          router.replace("/(tabs)/home");
        }
      } catch (error) {
        void error;
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isCheckingSession) {
    return <View className="flex-1 bg-azul-primario" />;
  }

  return (
    <View className="flex-1 bg-azul-primario">
      <Image
        source={require("../assets/images/loira.png")}
        className="absolute top-[15%] bottom-0 left-0 right-0 w-full h-[100%]"
        resizeMode="contain"
      />
      <SafeAreaView className="flex-1 justify-between">
        <Image
          source={require("../assets/images/logo_branco.png")}
          className="self-center w-[60%] mt-4 bottom-[20%]"
          resizeMode="contain"
        />

        <View className="gap-2">
          <Button 
          title="Acesse sua conta"
          onPress={() => router.push("/login")}
          isPrimary={true}
          />
          <Button 
          title="Crie uma nova conta"
          onPress={() => router.push("/register")}
          isPrimary={false}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
