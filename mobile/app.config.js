const googleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  console.warn(
    'ANDROID_GOOGLE_MAPS_API_KEY is not set — the Android build will fail to render maps ' +
      '(react-native-maps requires it). See mobile/README.md for how to get and set one.'
  );
}

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
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
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
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
    ],
  },
};
