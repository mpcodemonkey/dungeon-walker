module.exports = {
  expo: {
    name: 'Dungeon Walker',
    slug: 'dungeon-walker',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.dungeonwalker.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Dungeon Walker uses your location to place your avatar on the map and reveal nearby dungeons.",
        NSMotionUsageDescription: "Dungeon Walker counts your steps to power your character's movement and combat.",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'android.permission.health.READ_STEPS'],
      package: 'com.dungeonwalker.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Dungeon Walker uses your location to place your avatar on the map and reveal nearby dungeons.',
        },
      ],
      'expo-health-connect',
      './plugins/withHealthConnectMainActivity',
      '@maplibre/maplibre-react-native',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
            // Android blocks plain http:// traffic by default in real
            // native builds (unlike Expo Go, which is permissive about
            // this for local dev) — needed to reach the dev server over
            // your LAN. Revisit before any production release: the real
            // API should be HTTPS, and this should come out entirely.
            usesCleartextTraffic: true,
          },
        },
      ],
    ],
  },
};
