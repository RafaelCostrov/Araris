import { useEffect, useState } from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { House, ChartColumnIncreasing, Landmark, BotMessageSquare } from "lucide-react-native";
import CustomHeader from "../../components/Header";
import AddButton from "../../components/AddButton";
import PeriodTransitionOverlay from "../../components/PeriodTransitionOverlay";
import { useAuth } from "../../contexts/AuthContext";
import {
  FinancePeriodProvider,
  useFinancePeriod,
} from "../../contexts/FinancePeriodContext";

function TabBackground() {
  if (Platform.OS === "android") return null;
  return <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />;
}

function FinanceTabs() {
  const { isMonthTransitioning } = useFinancePeriod();
  const pathname = usePathname();
  const showMonthSelector = ![
    "/dashboard",
    "/irs",
    "/chatbot",
    "/account",
    "/settings",
  ].some((route) => pathname.includes(route));

  return (
    <View className="flex-1">
      <CustomHeader showMonthSelector={showMonthSelector} />
      <View className="flex-1">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: styles.tabBar,
            tabBarItemStyle: styles.tabItem,
            tabBarBackground: () => <TabBackground />,
          }}
        >
          <Tabs.Screen
            name="home/index"
            options={{
              tabBarIcon: ({ color, size }) => (
                <House color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="dashboard/index"
            options={{
              tabBarIcon: ({ color, size }) => (
                <ChartColumnIncreasing color={color} size={size} />
              ),
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
              tabBarIcon: ({ color, size }) => (
                <Landmark color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="chatbot/index"
            options={{
              tabBarStyle: { display: "none" },
              tabBarIcon: ({ color, size }) => (
                <BotMessageSquare color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="finance-details/index"
            options={{ href: null, animation: "shift" }}
          />
          <Tabs.Screen
            name="account/index"
            options={{
              href: null,
              animation: "shift",
              tabBarStyle: { display: "none" },
            }}
          />
          <Tabs.Screen
            name="settings/index"
            options={{
              href: null,
              animation: "shift",
              tabBarStyle: { display: "none" },
            }}
          />
        </Tabs>
        <PeriodTransitionOverlay visible={isMonthTransitioning} />
      </View>
    </View>
  );
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
    <FinancePeriodProvider>
      <FinanceTabs />
    </FinancePeriodProvider>
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
