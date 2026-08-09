import { useEffect, useState } from "react";
import { Bell, LogOut, Settings, User } from "lucide-react-native";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useFinancePeriod } from "../../contexts/FinancePeriodContext";
import MonthSelector from "../MonthSelector";
import {
  addNotificationReceivedListener,
  listNotifications,
  markNotificationAsRead,
} from "../../services/notificationService";


export default function CustomHeader({ showMonthSelector = true }) {
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);
  const [isNotificationMenuVisible, setIsNotificationMenuVisible] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { signOut, user } = useAuth();
  const { selectedMonth, setSelectedMonth } = useFinancePeriod();
  const hasUnreadNotifications = notifications.some(
    (notification) => !notification.read_at,
  );

  useEffect(() => {
    let isMounted = true;

    async function refreshNotifications() {
      try {
        const data = await listNotifications();
        if (isMounted) {
          setNotifications(data);
        }
      } catch {}
    }

    refreshNotifications();
    const notificationSubscription = addNotificationReceivedListener(
      refreshNotifications,
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          refreshNotifications();
        }
      },
    );

    return () => {
      isMounted = false;
      notificationSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  function closeProfileMenu() {
    setIsProfileMenuVisible(false);
  }

  function closeNotificationMenu() {
    setIsNotificationMenuVisible(false);
  }

  async function loadNotifications() {
    try {
      setIsLoadingNotifications(true);
      const data = await listNotifications();
      setNotifications(data);
    } catch (error) {
      Alert.alert(
        "Notificações",
        error.message || "Não foi possível carregar suas notificações.",
      );
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  async function openNotificationMenu() {
    setIsNotificationMenuVisible(true);
    await loadNotifications();
  }

  async function handleNotificationPress(notification) {
    if (notification.read_at) {
      return;
    }

    try {
      const updatedNotification = await markNotificationAsRead(notification.id);
      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? updatedNotification
            : currentNotification,
        ),
      );
    } catch (error) {
      Alert.alert(
        "Notificações",
        error.message || "Não foi possível marcar a notificação como lida.",
      );
    }
  }

  function openUserSection(path) {
    closeProfileMenu();
    router.push(path);
  }

  async function handleLogout() {
    closeProfileMenu();
    await signOut();
    router.replace("/login");
  }

  function confirmLogout() {
    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair da sua conta?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: handleLogout,
        },
      ],
    );
  }

  return (
    <SafeAreaView className="bg-azul-primario px-6 pb-4" edges={["top"]}>
      <View className="flex-row items-center justify-between h-16">
        <Image
          source={require("../../assets/images/logo_branco.png")}
          className="w-32 h-9"
          resizeMode="contain"
        />
        <View className="flex-row items-center gap-3">
          {showMonthSelector ? (
            <MonthSelector
              value={selectedMonth}
              onChange={setSelectedMonth}
              variant="header"
            />
          ) : null}
          <TouchableOpacity
            className="relative p-1"
            activeOpacity={0.7}
            onPress={openNotificationMenu}
          >
            <Bell color="#fff" size={25} />
            {hasUnreadNotifications ? (
              <View className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-azul-primario bg-red-500" />
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsProfileMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir opções do usuário"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full border border-white">
              <User size={21} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={isProfileMenuVisible}
        onRequestClose={closeProfileMenu}
      >
        <Pressable className="flex-1 bg-black/10" onPress={closeProfileMenu}>
          <View className="absolute right-5 top-24 w-56 rounded-xl bg-white py-2 shadow-lg">
            {user ? (
              <View className="px-4 pb-2 pt-1">
                <Text className="font-poppins-semibold text-texto-primario">
                  {user.name}
                </Text>
                <Text className="font-poppins-regular text-xs text-texto-terciario">
                  {user.email}
                </Text>
              </View>
            ) : null}

            {user ? <View className="my-1 h-[1px] bg-gray-200" /> : null}

            <Pressable
              className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
              onPress={() => openUserSection("/(tabs)/account")}
            >
              <User size={20} color="#111827" />
              <Text className="font-poppins-medium text-texto-primario">
                Conta
              </Text>
            </Pressable>

            <Pressable
              className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
              onPress={() => openUserSection("/(tabs)/settings")}
            >
              <Settings size={20} color="#111827" />
              <Text className="font-poppins-medium text-texto-primario">
                Configurações
              </Text>
            </Pressable>

            <View className="my-1 h-[1px] bg-gray-200" />

            <Pressable
              className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-100"
              onPress={confirmLogout}
            >
              <LogOut size={20} color="#dc2626" />
              <Text className="font-poppins-medium text-red-600">
                Sair
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={isNotificationMenuVisible}
        onRequestClose={closeNotificationMenu}
      >
        <Pressable className="flex-1 bg-black/10" onPress={closeNotificationMenu}>
          <Pressable className="absolute right-5 top-24 w-80 max-h-[70%] rounded-xl bg-white py-3 shadow-lg">
            <View className="px-4 pb-3">
              <Text className="font-poppins-semibold text-lg text-texto-primario">
                Notificações
              </Text>
              <Text className="font-poppins-regular text-xs text-texto-terciario">
                Alertas e avisos do Araris
              </Text>
            </View>

            {isLoadingNotifications ? (
              <ActivityIndicator size="small" color="#0063f5" />
            ) : (
              <ScrollView className="max-h-80">
                {notifications.length === 0 ? (
                  <Text className="px-4 py-4 text-center font-poppins-regular text-texto-terciario">
                    Nenhuma notificação por enquanto.
                  </Text>
                ) : (
                  notifications.map((notification) => (
                    <Pressable
                      key={notification.id}
                      className="border-t border-gray-100 px-4 py-3 active:bg-gray-100"
                      onPress={() => handleNotificationPress(notification)}
                    >
                      <View className="flex-row items-start gap-2">
                        {!notification.read_at ? (
                          <View className="mt-2 h-2 w-2 rounded-full bg-azul-primario" />
                        ) : (
                          <View className="mt-2 h-2 w-2 rounded-full bg-gray-300" />
                        )}
                        <View className="flex-1">
                          <Text className="font-poppins-semibold text-texto-primario">
                            {notification.title}
                          </Text>
                          <Text className="font-poppins-regular text-sm text-texto-secundario">
                            {notification.message}
                          </Text>
                          <Text className="mt-1 font-poppins-regular text-xs text-texto-terciario">
                            {notification.delivery_status_label}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
