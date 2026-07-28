import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

type LoadState =
  | { status: 'requesting-permission' }
  | { status: 'permission-denied' }
  | { status: 'locating' }
  | { status: 'ready'; coords: { latitude: number; longitude: number } }
  | { status: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'requesting-permission' });

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ status: 'permission-denied' });
        return;
      }

      setState({ status: 'locating' });

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 5 },
        (location) => {
          setState({
            status: 'ready',
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          });
        }
      );
    })().catch((error) => {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    });

    return () => subscription?.remove();
  }, []);

  if (state.status === 'ready') {
    return (
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: state.coords.latitude,
            longitude: state.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={false}
        >
          <Marker coordinate={state.coords} title="You" description="Placeholder avatar" />
        </MapView>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.centered}>
        <Text style={styles.statusText}>{statusMessage(state)}</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

function statusMessage(state: Exclude<LoadState, { status: 'ready' }>): string {
  switch (state.status) {
    case 'requesting-permission':
      return 'Requesting location permission…';
    case 'permission-denied':
      return 'Location permission denied. Dungeon Walker needs location access to place your avatar on the map.';
    case 'locating':
      return 'Finding your location…';
    case 'error':
      return `Something went wrong: ${state.message}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statusText: {
    textAlign: 'center',
    fontSize: 16,
  },
});
