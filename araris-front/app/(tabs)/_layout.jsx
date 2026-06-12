import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { House, ChartColumnIncreasing, Landmark, BotMessageSquare } from "lucide-react-native";
import CustomHeader from "../../components/Header";
import AddButton from "../../components/AddButton";

function TabBackground() {
  if (Platform.OS === "android") return null;
  return <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />;
}

export default function TabsLayout() {
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