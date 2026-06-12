/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        "poppins-thin":             ["Poppins_100Thin"],
        "poppins-thin-italic":      ["Poppins_100Thin_Italic"],
        "poppins-extralight":       ["Poppins_200ExtraLight"],
        "poppins-extralight-italic":["Poppins_200ExtraLight_Italic"],
        "poppins-light":            ["Poppins_300Light"],
        "poppins-light-italic":     ["Poppins_300Light_Italic"],
        "poppins-regular":          ["Poppins_400Regular"],
        "poppins-regular-italic":   ["Poppins_400Regular_Italic"],
        "poppins-medium":           ["Poppins_500Medium"],
        "poppins-medium-italic":    ["Poppins_500Medium_Italic"],
        "poppins-semibold":         ["Poppins_600SemiBold"],
        "poppins-semibold-italic":  ["Poppins_600SemiBold_Italic"],
        "poppins-bold":             ["Poppins_700Bold"],
        "poppins-bold-italic":      ["Poppins_700Bold_Italic"],
        "poppins-extrabold":        ["Poppins_800ExtraBold"],
        "poppins-extrabold-italic": ["Poppins_800ExtraBold_Italic"],
        "poppins-black":            ["Poppins_900Black"],
        "poppins-black-italic":     ["Poppins_900Black_Italic"],
      },
      colors: {
        "azul-primario": "#0063f5",
        "azul-escuro": "#162A94",
        "texto-primario": "#343A40",
        "texto-secundario": "#343A40",
        "texto-terciario": "#6C757D",
      },
    },
  },
  plugins: [],
}