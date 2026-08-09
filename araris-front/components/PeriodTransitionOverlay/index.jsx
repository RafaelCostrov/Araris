import { useEffect, useRef, useState } from "react";
import { BlurView } from "expo-blur";
import { Animated, StyleSheet, View } from "react-native";

export default function PeriodTransitionOverlay({ visible }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    opacity.stopAnimation();

    if (visible) {
      setIsMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [opacity, visible]);

  if (!visible && !isMounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.container, { opacity }]}
      accessibilityLabel="Atualizando período financeiro"
    >
      <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    elevation: 50,
    zIndex: 1000,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
});
