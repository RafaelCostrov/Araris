const appJson = require("./app.json");

function getGoogleSignInPlugin() {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

  if (!iosUrlScheme) {
    return "@react-native-google-signin/google-signin";
  }

  return [
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme,
    },
  ];
}

function normalizePlugin(plugin) {
  const pluginName = typeof plugin === "string" ? plugin : plugin[0];

  if (pluginName === "@react-native-google-signin/google-signin") {
    return null;
  }

  if (pluginName === "expo-splash-screen") {
    return [
      "expo-splash-screen",
      {
        image: "./assets/images/logo_branco.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0063f5",
        dark: {
          backgroundColor: "#0063f5",
        },
      },
    ];
  }

  return plugin;
}

module.exports = () => {
  const expo = appJson.expo;
  const plugins = expo.plugins.map(normalizePlugin).filter(Boolean);

  return {
    ...expo,
    name: "Araris",
    icon: "./assets/images/araris_icon.png",
    scheme: process.env.EXPO_PUBLIC_APP_SCHEME || "araris",
    ios: {
      ...expo.ios,
      bundleIdentifier:
        process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER ||
        expo.ios?.bundleIdentifier ||
        "com.araris",
      googleServicesFile: "./GoogleService-Info.plist", 
      infoPlist: {
        ...expo.ios?.infoPlist,
        CFBundleName: "Araris",
        CFBundleDisplayName: "Araris",
      },
    },
    android: {
      edgeToEdgeEnabled: expo.android?.edgeToEdgeEnabled,
      predictiveBackGestureEnabled: expo.android?.predictiveBackGestureEnabled,
      softwareKeyboardLayoutMode:
        expo.android?.softwareKeyboardLayoutMode || "resize",
      package:
        process.env.EXPO_PUBLIC_ANDROID_PACKAGE ||
        expo.android?.package ||
        "com.araris",
      adaptiveIcon: {
        backgroundColor:
          expo.android?.adaptiveIcon?.backgroundColor || "#0063f5",
        foregroundImage: "./assets/images/araris_icon.png",
      },
      googleServicesFile: "./google-services.json",
    },
    web: {
      ...expo.web,
      favicon: "./assets/images/araris_icon.png",
    },
    extra: {
      ...expo.extra,
      eas: {
        ...expo.extra?.eas,
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
          expo.extra?.eas?.projectId ||
          "55204642-6105-4f01-8b5d-138fd729674a",
      },
    },
    plugins: [...plugins, getGoogleSignInPlugin()],
  };
};
