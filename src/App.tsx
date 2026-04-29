// Airgap — https://github.com/xmpuspus/airgap
// Copyright 2026 Xavier Puspus. MIT license.
import React, {useEffect, useState} from 'react';
import {TouchableOpacity, Text, View, Image, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {COLORS, SPACING, TYPOGRAPHY, ThemeProvider} from './constants/theme';
import {brand} from './config/loader';
import {connectivityService} from './services/connectivityService';
import {
  startSyncScheduler,
  stopSyncScheduler,
  loadBundleIntoKnowledge,
} from './services/syncService';
import {modelManager} from './services/modelManager';
import {startTelemetryFlusher} from './services/telemetry';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import ChatScreen from './screens/ChatScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import SettingsScreen from './screens/SettingsScreen';
import {StalenessChip} from './components/common/StalenessChip';
import {createMMKV} from 'react-native-mmkv';

const storage = createMMKV({id: 'app-state'});
const Stack = createNativeStackNavigator();

function HeaderTitle() {
  return (
    <View style={headerStyles.titleRow}>
      <View style={headerStyles.avatarRing}>
        <Image
          source={require('../assets/images/airgap-avatar.png')}
          style={headerStyles.avatarImage}
          resizeMode="cover"
        />
      </View>
      <View>
        <Text style={headerStyles.botName}>{brand.botName}</Text>
        <View style={headerStyles.subRow}>
          <Text style={headerStyles.brandLabel}>{brand.name}</Text>
          <View style={headerStyles.subDivider} />
          <StalenessChip />
        </View>
      </View>
    </View>
  );
}

function SettingsButton({onPress}: {onPress: () => void}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
      accessibilityLabel="Open settings"
      accessibilityRole="button"
      style={headerStyles.settingsButton}>
      <View style={headerStyles.gearOuter}>
        <View style={headerStyles.gearInner} />
      </View>
    </TouchableOpacity>
  );
}

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    const onboarded = storage.getBoolean('has_onboarded') ?? false;
    setHasOnboarded(onboarded);
    // Boot-time KB bootstrap: if a previously-downloaded bundle is on disk,
    // rebuild the MiniSearch index from it BEFORE the scheduler kicks off
    // a new sync. On any failure we fall back to the compiled-in KB so the
    // app is always usable.
    loadBundleIntoKnowledge()
      .catch(() => undefined)
      .finally(() => {
        // Sync + telemetry are no-ops when backend.type is 'mock' — the
        // individual services gate their own side effects on baseUrl presence.
        startSyncScheduler();
        startTelemetryFlusher();
        // Wi-Fi-gated background poll for model updates. Throttled to once
        // per 6 hours and silent on cellular — never burns mobile data.
        modelManager
          .checkForUpdate()
          .catch(() => undefined);
      });
    return () => {
      stopSyncScheduler();
      connectivityService.destroy();
    };
  }, []);

  const completeOnboarding = () => {
    storage.set('has_onboarded', true);
    setHasOnboarded(true);
  };

  if (hasOnboarded === null) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={hasOnboarded ? 'Chat' : 'Onboarding'}
            screenOptions={{
              headerStyle: {backgroundColor: COLORS.primary},
              headerTintColor: COLORS.textInverse,
              headerTitleStyle: {fontWeight: '600'},
              headerShadowVisible: false,
            }}>
            <Stack.Screen
              name="Onboarding"
              options={{headerShown: false}}>
              {(props: any) => (
                <OnboardingScreen
                  {...props}
                  onComplete={completeOnboarding}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="Chat"
              component={ChatScreen as any}
              options={({navigation}: any) => ({
                /* eslint-disable react/no-unstable-nested-components --
                 * React Navigation's headerTitle/headerRight options expect
                 * factory functions that return JSX. The factory is called
                 * by the navigator, not by our render loop, so the
                 * "unstable component" concern does not apply. */
                headerTitle: () => <HeaderTitle />,
                headerRight: () => (
                  <SettingsButton
                    onPress={() => navigation.navigate('Settings')}
                  />
                ),
                /* eslint-enable react/no-unstable-nested-components */
              })}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen as any}
              options={{
                title: 'Settings',
                headerBackTitle: 'Back',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const headerStyles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  botName: {
    ...TYPOGRAPHY.title,
    fontSize: 17,
    color: COLORS.textInverse,
  },
  brandLabel: {
    ...TYPOGRAPHY.micro,
    color: 'rgba(255,255,255,0.65)',
    marginTop: -1,
    letterSpacing: 0.3,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subDivider: {
    width: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 6,
  },
  settingsButton: {
    padding: SPACING.xs,
  },
  gearOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textInverse,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  gearInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.textInverse,
  },
});
