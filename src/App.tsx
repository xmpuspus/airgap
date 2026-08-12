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
import OutboxScreen from './screens/OutboxScreen';
import {StalenessChip} from './components/common/StalenessChip';
import {getSecureStore, initializeSecureStorage} from './services/secureStorage';

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

function HeaderActions({onOutbox, onSettings}: {onOutbox: () => void; onSettings: () => void}) {
  return (
    <View style={headerStyles.actions}>
      <TouchableOpacity
        style={headerStyles.outboxButton}
        onPress={onOutbox}
        accessibilityLabel="Open Outbox"
        accessibilityRole="button">
        <Text style={headerStyles.outboxText}>Outbox</Text>
      </TouchableOpacity>
      <SettingsButton onPress={onSettings} />
    </View>
  );
}

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function startApplication() {
      try {
        await initializeSecureStorage();
        if (!active) return;

        const onboarded = getSecureStore('app-state').getBoolean('has_onboarded') ?? false;
        setHasOnboarded(onboarded);

        await loadBundleIntoKnowledge().catch(() => undefined);
        if (!active) return;

        startSyncScheduler();
        startTelemetryFlusher();
        modelManager.checkForUpdate().catch(() => undefined);
      } catch {
        if (active) {
          setStartupError('Secure storage is unavailable. Unlock the device and restart Airgap.');
        }
      }
    }

    startApplication();
    return () => {
      active = false;
      stopSyncScheduler();
      connectivityService.destroy();
    };
  }, []);

  const completeOnboarding = () => {
    getSecureStore('app-state').set('has_onboarded', true);
    setHasOnboarded(true);
  };

  if (startupError) {
    return (
      <SafeAreaProvider>
        <View style={startupStyles.screen} accessibilityRole="alert">
          <Text style={startupStyles.title}>Airgap could not start</Text>
          <Text style={startupStyles.message}>{startupError}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (hasOnboarded === null) return null;

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={hasOnboarded ? 'Chat' : 'Onboarding'}
              screenOptions={{
                headerStyle: {backgroundColor: '#0B1F33'},
                headerTintColor: COLORS.textInverse,
                headerTitleStyle: {fontWeight: '600'},
                headerShadowVisible: false,
              }}>
              <Stack.Screen name="Onboarding" options={{headerShown: false}}>
                {(props: any) => <OnboardingScreen {...props} onComplete={completeOnboarding} />}
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
                    <HeaderActions
                      onOutbox={() => navigation.navigate('Outbox')}
                      onSettings={() => navigation.navigate('Settings')}
                    />
                  ),
                  /* eslint-enable react/no-unstable-nested-components */
                })}
              />
              <Stack.Screen
                name="Outbox"
                component={OutboxScreen as any}
                options={{title: 'Outbox', headerBackTitle: 'Back'}}
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

const startupStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

const headerStyles = StyleSheet.create({
  actions: {flexDirection: 'row', alignItems: 'center', gap: SPACING.xs},
  outboxButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  outboxText: {...TYPOGRAPHY.caption, color: '#FFFFFF', fontWeight: '700'},
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
