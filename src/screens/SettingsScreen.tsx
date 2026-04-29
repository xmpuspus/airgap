import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Linking,
  Share,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useModelDownload} from '../hooks/useModelDownload';
import {COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY} from '../constants/theme';
import {brand, config, features, modelConfig, privacy} from '../config/loader';
import {clearConversationHistory, getConversationHistory} from '../services/orchestrator';
import {modelManager} from '../services/modelManager';
import {t} from '../utils/i18n';
import {createMMKV} from 'react-native-mmkv';
import {DiagnosticsPanel} from '../components/settings/DiagnosticsPanel';
import {LLMModeControl} from '../components/settings/LLMModeControl';
import {SyncSectionCard} from '../components/settings/SyncSectionCard';

type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  Onboarding: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const APP_VERSION = '1.0.0';
const appStorage = createMMKV({id: 'app-state'});

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function SettingsRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, valueColor ? {color: valueColor} : undefined]}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({title}: {title: string}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Chevron() {
  return (
    <View style={styles.chevron}>
      <View style={styles.chevronTop} />
      <View style={styles.chevronBottom} />
    </View>
  );
}

export function SettingsScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {isDownloaded, modelSizeMB, deleteModel} = useModelDownload();

  // 7-tap easter egg on the app version row enables the Diagnostics panel
  // for the current session only. Not persisted — closing and reopening
  // Settings resets it. Operators who want it permanently flip
  // features.diagnosticsPanel in airgap.config.json.
  const [, setTapCount] = useState(0);
  const [diagnosticsOverride, setDiagnosticsOverride] = useState(false);
  const handleVersionTap = useCallback(() => {
    setTapCount(prev => {
      const next = prev + 1;
      if (next >= 7 && !diagnosticsOverride) {
        setDiagnosticsOverride(true);
      }
      return next;
    });
  }, [diagnosticsOverride]);
  const showDiagnostics = features.diagnosticsPanel || diagnosticsOverride;

  const handleDeleteModel = () => {
    Alert.alert(
      t('deleteModel', 'Delete AI Model'),
      t('deleteModelConfirm', 'This will remove the offline AI assistant. You can re-download it later.'),
      [
        {text: t('cancel', 'Cancel'), style: 'cancel'},
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: () => deleteModel(),
        },
      ],
    );
  };

  const handleRedownload = () => {
    navigation.navigate('Onboarding' as any);
  };

  const handleClearChat = () => {
    Alert.alert(
      t('clearChat', 'Clear Conversation'),
      t('clearChatConfirm', 'This will delete all messages. This cannot be undone.'),
      [
        {text: t('cancel', 'Cancel'), style: 'cancel'},
        {
          text: t('clear', 'Clear'),
          style: 'destructive',
          onPress: () => {
            clearConversationHistory();
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleExportChat = async () => {
    try {
      const history = getConversationHistory();
      if (!history || history.length === 0) {
        Alert.alert(t('exportChat', 'Export Chat'), t('noChatHistory', 'No conversation history to export.'));
        return;
      }
      const lines = history.map(turn => `${turn.role === 'user' ? 'You' : brand.botName}: ${turn.text}`);
      const text = `${brand.botName} — Chat Export\n${new Date().toLocaleDateString()}\n${'='.repeat(40)}\n\n${lines.join('\n\n')}`;
      await Share.share({message: text, title: `${brand.botName} Chat Export`});
    } catch {
      // Share cancelled
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      t('deleteAllData', 'Delete All Data'),
      t('deleteAllDataConfirm', 'This will delete all conversations, model data, and reset the app. This cannot be undone.'),
      [
        {text: t('cancel', 'Cancel'), style: 'cancel'},
        {
          text: t('deleteAll', 'Delete Everything'),
          style: 'destructive',
          onPress: async () => {
            clearConversationHistory();
            await modelManager.deleteModel();
            appStorage.set('has_onboarded', false);
            navigation.reset({index: 0, routes: [{name: 'Onboarding' as any}]});
          },
        },
      ],
    );
  };

  const handleContact = (type: string, value: string) => {
    switch (type) {
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      case 'website':
        Linking.openURL(`https://${value}`);
        break;
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{paddingBottom: insets.bottom + SPACING['3xl']}}>
      {/* AI Model */}
      <View style={styles.section}>
        <SectionHeader title={t('aiModel', 'AI Model')} />
        <View style={styles.card}>
          <SettingsRow
            label={t('status', 'Status')}
            value={isDownloaded ? t('downloaded', 'Downloaded') : t('notDownloaded', 'Not downloaded')}
            valueColor={isDownloaded ? COLORS.success : COLORS.textSecondary}
          />
          <View style={styles.divider} />
          <SettingsRow label={t('model', 'Model')} value={modelConfig.filename} />
          <View style={styles.divider} />
          <SettingsRow label={t('size', 'Size')} value={formatSize(modelSizeMB)} />
          {isDownloaded && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleDeleteModel}
                activeOpacity={0.6}
                accessibilityLabel={t('deleteModel', 'Delete AI Model')}
                accessibilityRole="button">
                <Text style={styles.deleteText}>{t('deleteModel', 'Delete Model')}</Text>
              </TouchableOpacity>
            </>
          )}
          {!isDownloaded && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleRedownload}
                activeOpacity={0.6}
                accessibilityLabel={t('downloadModel', 'Download AI Model')}
                accessibilityRole="button">
                <Text style={styles.primaryActionText}>{t('downloadModel', 'Download Model')}</Text>
                <Chevron />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Knowledge Sync */}
      <View style={styles.section}>
        <SectionHeader title={t('sync.title', 'Knowledge Sync')} />
        <SyncSectionCard />
      </View>

      {/* AI Mode */}
      <View style={styles.section}>
        <SectionHeader title={t('llmMode.title', 'AI Mode')} />
        <View style={styles.card}>
          <LLMModeControl />
        </View>
      </View>

      {/* Chat */}
      <View style={styles.section}>
        <SectionHeader title={t('chat', 'Chat')} />
        <View style={styles.card}>
          {privacy.allowExport && (
            <>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleExportChat}
                activeOpacity={0.6}
                accessibilityLabel={t('exportChat', 'Export conversation')}
                accessibilityRole="button">
                <Text style={styles.primaryActionText}>{t('exportChat', 'Export Conversation')}</Text>
                <Chevron />
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          )}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearChat}
            activeOpacity={0.6}
            accessibilityLabel={t('clearChat', 'Clear conversation history')}
            accessibilityRole="button">
            <Text style={styles.deleteText}>{t('clearChat', 'Clear Conversation History')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy */}
      {(privacy.allowDeleteData || privacy.privacyPolicyUrl || privacy.dataRetentionDays) && (
        <View style={styles.section}>
          <SectionHeader title={t('privacy', 'Privacy')} />
          <View style={styles.card}>
            {privacy.dataRetentionDays && (
              <>
                <SettingsRow
                  label={t('dataRetention', 'Data Retention')}
                  value={`${privacy.dataRetentionDays} days`}
                />
                <View style={styles.divider} />
              </>
            )}
            {privacy.privacyPolicyUrl && (
              <>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => Linking.openURL(privacy.privacyPolicyUrl!)}
                  activeOpacity={0.6}
                  accessibilityLabel={t('privacyPolicy', 'Privacy Policy')}
                  accessibilityRole="link">
                  <Text style={styles.label}>{t('privacyPolicy', 'Privacy Policy')}</Text>
                  <View style={styles.linkRow}>
                    <Text style={styles.linkValue}>View</Text>
                    <Chevron />
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </>
            )}
            {privacy.allowDeleteData && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleDeleteAllData}
                activeOpacity={0.6}
                accessibilityLabel={t('deleteAllData', 'Delete all my data')}
                accessibilityRole="button">
                <Text style={styles.deleteText}>{t('deleteAllData', 'Delete All My Data')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Support */}
      {config.support && config.support.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('getHelp', 'Get Help')} />
          <View style={styles.card}>
            {config.support.map((channel, index) => (
              <React.Fragment key={channel.value}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => handleContact(channel.type, channel.value)}
                  activeOpacity={0.6}
                  accessibilityLabel={`Contact via ${channel.label}`}
                  accessibilityRole="link">
                  <Text style={styles.label}>{channel.label}</Text>
                  <View style={styles.linkRow}>
                    <Text style={styles.linkValue}>{channel.value}</Text>
                    <Chevron />
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Diagnostics (gated by config flag OR session override via 7-tap) */}
      {showDiagnostics ? (
        <View style={styles.section}>
          <SectionHeader title={t('diagnostics', 'Diagnostics')} />
          <View style={styles.card}>
            <DiagnosticsPanel />
          </View>
        </View>
      ) : null}

      {/* About */}
      <View style={styles.section}>
        <SectionHeader title={t('about', 'About')} />
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleVersionTap}
            accessibilityLabel={t('appVersion', 'App Version')}
            accessibilityHint={t('appVersion.tapHint', 'Tap seven times to enable diagnostics for this session')}>
            <SettingsRow label={t('appVersion', 'App Version')} value={APP_VERSION} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.aboutBlock}>
            <Text style={styles.aboutText}>
              {brand.botName} is an AI-powered assistant for {brand.name}.
              It runs entirely on your device — your conversations never leave
              your phone.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm + 2,
    marginLeft: SPACING.xs,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
    opacity: 0.6,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border + '60',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md + 3,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
  },
  value: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  linkValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.lg,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md + 3,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
  },
  deleteText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    fontWeight: '600',
  },
  primaryActionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  chevron: {
    width: 8,
    height: 14,
    justifyContent: 'center',
    opacity: 0.5,
  },
  chevronTop: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.textSecondary,
    borderRadius: 1,
    transform: [{rotate: '45deg'}, {translateY: 2}],
  },
  chevronBottom: {
    width: 8,
    height: 2,
    backgroundColor: COLORS.textSecondary,
    borderRadius: 1,
    transform: [{rotate: '-45deg'}, {translateY: -2}],
  },
  aboutBlock: {
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.lg,
  },
  aboutText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
});
