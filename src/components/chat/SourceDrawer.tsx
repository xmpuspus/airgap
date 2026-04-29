import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, RADIUS, SPACING, TIMING, TYPOGRAPHY} from '../../constants/theme';
import {getDocById} from '../../services/searchService';
import {useSourceDrawer} from '../../hooks/useSourceDrawer';

// Bottom-sheet drawer hosted once per chat screen via SourceDrawerProvider.
// Visible state is driven by the drawer context.
export function SourceDrawer() {
  const {openDocId, close} = useSourceDrawer();
  const visible = openDocId !== null;
  const {height: screenHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerMaxHeight = Math.min(screenHeight * 0.7, 600);

  // Initialize off-screen so the sheet does not flash at the bottom on the
  // very first open before the spring runs.
  const slide = useRef(new Animated.Value(screenHeight)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: TIMING.normal,
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 0,
          ...TIMING.springSnappy,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: TIMING.fast,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: screenHeight,
          duration: TIMING.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fade, slide, screenHeight]);

  const doc = useMemo(
    () => (openDocId ? getDocById(openDocId) ?? null : null),
    [openDocId],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={close}
      {...(Platform.OS === 'android' ? {statusBarTranslucent: true} : {})}>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          style={[styles.scrim, {opacity: fade}]}
          pointerEvents={visible ? 'auto' : 'none'}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={close}
            accessibilityLabel="Dismiss source"
            accessibilityRole="button"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: drawerMaxHeight,
              paddingBottom: insets.bottom + SPACING.lg,
              transform: [{translateY: slide}],
            },
          ]}
          accessibilityViewIsModal>
          <View style={styles.handle} />
          {doc ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.category} numberOfLines={1}>
                  {String(doc.category).toUpperCase()}
                </Text>
                <Pressable
                  onPress={close}
                  hitSlop={12}
                  accessibilityLabel="Close source"
                  accessibilityRole="button"
                  style={styles.closeButton}>
                  <CloseGlyph />
                </Pressable>
              </View>
              <Text style={styles.title} accessibilityRole="header">
                {doc.title}
              </Text>
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator>
                <Text style={styles.bodyText}>{doc.content}</Text>
                {doc.tags && doc.tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {doc.tags.map(tag => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.fallback}>
              <Text style={styles.fallbackTitle}>Source unavailable</Text>
              <Text style={styles.fallbackBody}>
                This source is no longer in the knowledge base. Try
                refreshing the conversation or asking the question again.
              </Text>
              <Pressable
                onPress={close}
                style={styles.fallbackButton}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Text style={styles.fallbackButtonText}>Close</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Two crossed View bars rotated 45deg. Matches the project's existing
// View-shape glyph pattern (e.g. ChatScreen scroll-FAB chevron) instead
// of using a Text "×" character that VoiceOver reads as "multiplication".
function CloseGlyph() {
  return (
    <View style={glyphStyles.wrap} accessible={false}>
      <View style={[glyphStyles.bar, glyphStyles.barA]} />
      <View style={[glyphStyles.bar, glyphStyles.barB]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  category: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: SPACING.lg,
  },
  bodyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.botBubble,
  },
  tagText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textSecondary,
  },
  fallback: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  fallbackTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  fallbackBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  fallbackButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textInverse,
    fontWeight: '600',
  },
});

const glyphStyles = StyleSheet.create({
  wrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.textSecondary,
  },
  barA: {transform: [{rotate: '45deg'}]},
  barB: {transform: [{rotate: '-45deg'}]},
});
