import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { House, ChartColumnIncreasing, Landmark, BotMessageSquare } from "lucide-react-native";
import CustomHeader from "../../components/Header";
import AddButton from "../../components/AddButton";
import { useAuth } from "../../contexts/AuthContext";

function TabBackground() {
  if (Platform.OS === "android") return null;
  return <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />;
}

export default function TabsLayout() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { isAuthenticated, loadSession } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const session = isAuthenticated ? { user: true } : await loadSession();
        if (!session?.user && isMounted) {
          router.replace("/login");
        }
      } catch {
        if (isMounted) {
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, loadSession, router]);

  if (isCheckingSession) {
    return <View className="flex-1 bg-azul-primario" />;
  }

  return (
    <Tabs
      screenOptions={{
        header: () => <CustomHeader />,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarBackground: () => <TabBackground />,
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="dashboard/index"
        options={{
          tabBarIcon: ({ color, size }) => <ChartColumnIncreasing color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add/index"
        options={{
          tabBarButton: (props) => <AddButton onPress={props.onPress} />,
        }}
      />
      <Tabs.Screen
        name="irs/index"
        options={{
          tabBarIcon: ({ color, size }) => <Landmark  color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chatbot/index"
        options={{
          tabBarIcon: ({ color, size }) => <BotMessageSquare color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.98)" : "transparent",
    borderTopWidth: 0,
    elevation: 0,
  },
  tabItem: {
    paddingTop: 10,
  },
});
