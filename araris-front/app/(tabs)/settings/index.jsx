import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ArrowLeft,
  Bell,
  Info,
  ShieldCheck,
} from "lucide-react-native";

import Card from "../../../components/Card";
import SettingsActionCard from "../../../components/SettingsActionCard";
import {
  getNotificationPermissionState,
  registerCurrentDeviceForPush,
} from "../../../services/notificationService";


function notificationStatusLabel(permission) {
  if (!permission) {
    return "Verificando";
  }
  if (permission.status === "unsupported") {
    return "Indisponível";
  }
  return permission.granted ? "Ativas" : "Desativadas";
}


export default function SettingsPage() {
  const router = useRouter();
  const [permission, setPermission] = useState(null);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

  const loadPermission = useCallback(async () => {
    try {
      setPermission(await getNotificationPermissionState());
    } catch {
      setPermission({
        status: "error",
        granted: false,
        canAskAgain: false,
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPermission();
      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          loadPermission();
        }
      });
      return () => subscription.remove();
    }, [loadPermission]),
  );

  async function openNotificationSettings() {
    try {
      setIsUpdatingNotifications(true);
      if (!permission?.granted && permission?.canAskAgain) {
        await registerCurrentDeviceForPush();
        await loadPermission();
        return;
      }
      await Linking.openSettings();
    } catch (error) {
      Alert.alert(
        "Configurações de notificação",
        error.message || "Não foi possível abrir os ajustes do aparelho.",
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  }

  const notificationButtonLabel = permission?.granted
    ? "Abrir ajustes"
    : permission?.canAskAgain
      ? "Ativar notificações"
      : "Abrir ajustes";

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
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
          Configurações
        </Text>
        <Text className="mb-5 font-poppins-regular text-sm text-texto-terciario">
          Preferências e informações do aplicativo.
        </Text>

        <Text className="mb-2 font-poppins-semibold text-lg text-texto-primario">
          Notificações
        </Text>
        <Card className="mb-5 gap-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
              <Bell size={21} color="#0063f5" />
            </View>
            <View className="flex-1">
              <Text className="font-poppins-semibold text-base text-texto-primario">
                Permissão do aparelho
              </Text>
              <Text className="font-poppins-regular text-xs leading-5 text-texto-terciario">
                Controle se o Araris pode exibir avisos neste dispositivo.
              </Text>
            </View>
            <Text
              className={`font-poppins-semibold text-xs ${
                permission?.granted ? "text-green-700" : "text-texto-terciario"
              }`}
            >
              {notificationStatusLabel(permission)}
            </Text>
          </View>
          <Pressable
            className="items-center rounded-xl border border-azul-primario p-3 active:bg-blue-50"
            onPress={openNotificationSettings}
            disabled={isUpdatingNotifications || !permission}
            accessibilityRole="button"
          >
            {isUpdatingNotifications ? (
              <ActivityIndicator color="#0063f5" />
            ) : (
              <Text className="font-poppins-semibold text-azul-primario">
                {notificationButtonLabel}
              </Text>
            )}
          </Pressable>
        </Card>

        <Text className="mb-2 font-poppins-semibold text-lg text-texto-primario">
          Informações e suporte
        </Text>
        <View className="gap-3">
          <SettingsActionCard
            icon={<ShieldCheck size={21} color="#0063f5" />}
            title="Privacidade e dados"
            description="Saiba como suas informações são utilizadas."
            onPress={() => router.push("/privacy")}
          />
          <SettingsActionCard
            icon={<Info size={21} color="#0063f5" />}
            title="Sobre o Araris"
            description="Conheça a proposta e os recursos do aplicativo."
            onPress={() => router.push("/about")}
          />
        </View>

        <Text className="mt-7 text-center font-poppins-regular text-xs text-texto-terciario">
          Araris {Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </ScrollView>
    </View>
  );
}
