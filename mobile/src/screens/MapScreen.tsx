import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import type { Character } from '../api/client';
import { useGameplayState, type PedometerStatus } from '../movement/useGameplayState';
import { buildMapStyle } from '../map/style';

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

// Placeholder — how much AP a single "spend" tap burns. Tunable, see
// docs/chunk-4-combat.md.
const AP_BURST_AMOUNT = 50;

export function MapScreen({ character, token, onSignOut }: MapScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'requesting-permission' });
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const mapStyle = useMemo(() => buildMapStyle(), []);
  const { bankedAp, level, pedometerStatus, encounter, combatMessage, engage, dismiss, spendAp } = useGameplayState(
    token,
    character.bankedAp,
    character.level,
    state.status === 'ready' ? state.coords : undefined
  );

  useEffect(() => {
    if (state.status !== 'ready') return;
    cameraRef.current?.easeTo({
      center: [state.coords.longitude, state.coords.latitude],
      duration: 500,
    });
  }, [state]);

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
            {character.name} · Lv.{level}
          </Text>
          <Text style={styles.apText}>
            {bankedAp} AP{pedometerStatusSuffix(pedometerStatus)}
          </Text>
        </View>
        <TouchableOpacity onPress={onSignOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {combatMessage && (
        <Text style={styles.combatBanner}>{combatMessage}</Text>
      )}

      {encounter && <EncounterCard encounter={encounter} bankedAp={bankedAp} onEngage={engage} onDismiss={dismiss} onSpendAp={spendAp} />}

      {state.status === 'ready' ? (
        <Map style={styles.map} mapStyle={mapStyle}>
          <Camera
            ref={cameraRef}
            initialViewState={{ center: [state.coords.longitude, state.coords.latitude], zoom: 16 }}
          />
          <Marker lngLat={[state.coords.longitude, state.coords.latitude]}>
            <View style={styles.avatarMarker} />
          </Marker>
        </Map>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.statusText}>{statusMessage(state)}</Text>
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

interface EncounterCardProps {
  encounter: NonNullable<ReturnType<typeof useGameplayState>['encounter']>;
  bankedAp: number;
  onEngage: () => Promise<void>;
  onDismiss: () => Promise<void>;
  onSpendAp: (amount: number) => Promise<void>;
}

function EncounterCard({ encounter, bankedAp, onEngage, onDismiss, onSpendAp }: EncounterCardProps) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const vitalityFraction = encounter.currentVitality / encounter.enemy.maxVitality;

  return (
    <View style={styles.encounterCard}>
      <Text style={styles.encounterTitle}>{encounter.enemy.name}</Text>
      <View style={styles.vitalityTrack}>
        <View style={[styles.vitalityFill, { width: `${Math.max(vitalityFraction * 100, 0)}%` }]} />
      </View>
      <Text style={styles.vitalityText}>
        {encounter.currentVitality} / {encounter.enemy.maxVitality}
      </Text>

      {encounter.status === 'PENDING' ? (
        <View style={styles.encounterActions}>
          <TouchableOpacity style={styles.primaryButton} disabled={busy} onPress={() => run(onEngage)}>
            <Text style={styles.primaryButtonText}>Engage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} disabled={busy} onPress={() => run(onDismiss)}>
            <Text style={styles.secondaryButtonText}>Walk away</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.encounterActions}>
          <TouchableOpacity
            style={[styles.primaryButton, bankedAp <= 0 && styles.buttonDisabled]}
            disabled={busy || bankedAp <= 0}
            onPress={() => run(() => onSpendAp(Math.min(AP_BURST_AMOUNT, bankedAp)))}
          >
            <Text style={styles.primaryButtonText}>Spend {Math.min(AP_BURST_AMOUNT, bankedAp)} AP</Text>
          </TouchableOpacity>
          <Text style={styles.encounterHint}>Keep walking — every step deals damage.</Text>
        </View>
      )}
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
  combatBanner: {
    backgroundColor: '#2c3e50',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 13,
  },
  encounterCard: {
    margin: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#e6b3ad',
  },
  encounterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  vitalityTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  vitalityFill: {
    height: '100%',
    backgroundColor: '#c0392b',
  },
  vitalityText: {
    marginTop: 4,
    fontSize: 12,
    color: '#555',
  },
  encounterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#2c3e50',
  },
  encounterHint: {
    fontSize: 12,
    color: '#555',
    flexShrink: 1,
  },
  map: {
    flex: 1,
  },
  avatarMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2c3e50',
    borderWidth: 2,
    borderColor: '#fff',
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
