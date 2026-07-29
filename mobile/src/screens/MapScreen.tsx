import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import type { Character } from '../api/client';
import { useStepSync, type PedometerStatus } from '../movement/useStepSync';

type LoadState =
  | { status: 'requesting-permission' }
  | { status: 'permission-denied' }
  | { status: 'locating' }
  | { status: 'ready'; coords: { latitude: number; longitude: number } }
  | { status: 'error'; message: string };

interface MapScreenProps {
  character: Character;
  token: string;
  onSignOut: () => void;
}

export function MapScreen({ character, token, onSignOut }: MapScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'requesting-permission' });
  const insets = useSafeAreaInsets();
  const { bankedAp, pedometerStatus } = useStepSync(
    token,
    character.bankedAp,
    state.status === 'ready' ? state.coords : undefined
  );

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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerText}>
            {character.name} · Lv.{character.level}
          </Text>
          <Text style={styles.apText}>
            {bankedAp} AP{pedometerStatusSuffix(pedometerStatus)}
          </Text>
        </View>
        <TouchableOpacity onPress={onSignOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {state.status === 'ready' ? (
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
          <Marker coordinate={state.coords} title={character.name} description="Placeholder avatar" />
        </MapView>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.statusText}>{statusMessage(state)}</Text>
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

function pedometerStatusSuffix(status: PedometerStatus): string {
  switch (status) {
    case 'unavailable':
      return ' · step tracking unavailable on this device';
    case 'permission-denied':
      return ' · step tracking permission denied';
    case 'checking':
    case 'active':
      return '';
  }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  apText: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  logoutText: {
    color: '#c0392b',
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
