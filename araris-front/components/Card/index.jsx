import { Pressable, View } from "react-native";


const BASE_CARD_CLASSES = "rounded-2xl bg-white p-2 shadow-sm";


export default function Card({
  children,
  className = "",
  onPress,
  disabled = false,
  ...props
}) {
  const classes = `${BASE_CARD_CLASSES} ${className}`.trim();

  if (onPress) {
    return (
      <Pressable
        {...props}
        className={`${classes} active:opacity-75`}
        onPress={onPress}
        disabled={disabled}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View {...props} className={classes}>
      {children}
    </View>
  );
}
