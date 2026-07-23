// Converted from static app.json so android.googleServicesFile can resolve
// to the path EAS Build injects for the GOOGLE_SERVICES_JSON secret file
// environment variable during cloud builds (google-services.json itself is
// gitignored, so EAS Build's remote builder — which only uploads files
// tracked by git — never sees it otherwise). Falls back to the local file
// for `expo start`/local builds where the real file sits at the repo root.
module.exports = {
  expo: {
    name: "Royal Inventra",
    slug: "royal-inventra",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "royalinventra",
    userInterfaceStyle: "automatic",
    ios: {
      icon: "./assets/expo.icon",
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#f8fafc",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.judeewahsteam.royalinventra",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
    web: {
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#f8fafc",
          image: "./assets/images/splash-icon.png",
          imageWidth: 168,
          dark: {
            backgroundColor: "#0b0d12",
            image: "./assets/images/splash-icon.png",
          },
        },
      ],
      "expo-image",
      "expo-secure-store",
      "expo-status-bar",
      "expo-web-browser",
      "expo-sharing",
      [
        "expo-camera",
        {
          cameraPermission: "Royal Inventra uses your camera to scan product barcodes during checkout and stock entry.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Royal Inventra uses your photo library to add product photos.",
          cameraPermission: "Royal Inventra uses your camera to take product photos.",
        },
      ],
      "expo-notifications",
      // Pins the Google Services Gradle plugin to a specific version — see
      // plugins/withGoogleServicesVersion.js for why this needs a custom
      // plugin (neither Expo's own google-services injection nor
      // expo-build-properties expose an app.config.js option for it).
      [require("./plugins/withGoogleServicesVersion"), "4.5.0"],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "d6950080-af83-447e-acd1-fcd923c46a24",
      },
    },
    owner: "judeewahs-team",
  },
};
