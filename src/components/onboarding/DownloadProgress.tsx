import React, {useState, useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Animated} from 'react-native';
import {COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, TIMING} from '../../constants/theme';
import {config, onboarding, interpolate} from '../../config/loader';

interface DownloadProgressProps {
  onSkip?: () => void;
  onComplete?: () => void;
  progress: number;
  isDownloading: boolean;
  isDownloaded: boolean;
  modelSizeMB: number;
  startDownload: () => Promise<void>;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function DownloadProgress({
  onSkip: _onSkip,
  onComplete,
  progress,
  isDownloading,
  isDownloaded,
  modelSizeMB,
  startDownload,
}: DownloadProgressProps) {
  const [error, setError] = useState<string | null>(null);
  const progressWidth = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lastProgressRef = useRef({progress: 0, time: Date.now()});
  const [speedMBps, setSpeedMBps] = useState<number | null>(null);

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: progress,
      duration: 250,
      useNativeDriver: false,
    }).start();

    if (isDownloading && progress > 0) {
      const now = Date.now();
      const prev = lastProgressRef.current;
      const dtSec = (now - prev.time) / 1000;
      if (dtSec > 0.5) {
        const deltaMB = (progress - prev.progress) * modelSizeMB;
        const mbps = deltaMB / dtSec;
        if (mbps > 0) setSpeedMBps(mbps);
        lastProgressRef.current = {progress, time: now};
      }
    } else {
      setSpeedMBps(null);
      lastProgressRef.current = {progress: 0, time: Date.now()};
    }
  }, [progress, progressWidth, isDownloading, modelSizeMB]);

  // Pulse animation for progress bar
  useEffect(() => {
    if (isDownloading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isDownloading, pulseAnim]);

  useEffect(() => {
    if (isDownloaded) {
      Animated.spring(checkScale, {
        toValue: 1,
        ...TIMING.springGentle,
        useNativeDriver: true,
      }).start();
    }
  }, [isDownloaded, checkScale]);

  const handleStartDownload = async () => {
    setError(null);
    try {
      await startDownload();
      onComplete?.();
    } catch (err: any) {
      setError(err?.message || 'Download failed. Check your connection and try again.');
    }
  };

  const downloadedSize = formatSize(Math.round(progress * modelSizeMB));
  const totalSize = formatSize(modelSizeMB);

  if (isDownloaded) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[styles.completeIcon, {transform: [{scale: checkScale}]}]}>
          <View style={styles.checkShape} />
        </Animated.View>
        <Text style={styles.completeText}>AI model ready</Text>
        <Text style={styles.sizeText}>{totalSize} on device</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isDownloading ? (
        <>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  opacity: pulseAnim,
                  width: progressWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {downloadedSize} / {totalSize}
            </Text>
            <Text style={styles.progressPercent}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <Text style={styles.hint}>
            {speedMBps !== null
              ? `${speedMBps.toFixed(1)} MB/s${
                  speedMBps > 0
                    ? ` \u2022 ~${Math.ceil(((1 - progress) * modelSizeMB) / speedMBps / 60)}m left`
                    : ''
                }`
              : 'Downloading AI model...'}
          </Text>
        </>
      ) : (
        <>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleStartDownload}
            activeOpacity={0.8}>
            <Text style={styles.downloadButtonText}>
              {interpolate(
                onboarding?.downloadPrompt ??
                  'Download AI Assistant (~{{modelSize}})',
                config,
              )}
            </Text>
          </TouchableOpacity>
          <Text style={styles.wifiHint}>
            {onboarding?.wifiNote ?? 'WiFi recommended for download'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  downloadButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xl + SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
  },
  downloadButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  wifiHint: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm + 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: SPACING.xs,
  },
  progressText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.text,
    fontWeight: '600',
  },
  progressPercent: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    fontWeight: '700',
  },
  hint: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  completeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    shadowColor: COLORS.success,
    shadowOpacity: 0.25,
  },
  checkShape: {
    width: 18,
    height: 9,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: COLORS.textInverse,
    transform: [{rotate: '-45deg'}],
    marginTop: -3,
  },
  completeText: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sizeText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  errorBanner: {
    backgroundColor: COLORS.error + '0C',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.error + '20',
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    textAlign: 'center',
  },
});
