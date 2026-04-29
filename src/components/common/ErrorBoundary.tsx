import React, {Component, ErrorInfo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {logger} from '../../services/logger';
import {COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY} from '../../constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(_error: Error): State {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary', 'Uncaught render error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({hasError: false});
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>!</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            The app ran into an unexpected error. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Retry">
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
    backgroundColor: COLORS.background,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.error + '0C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.error + '20',
  },
  iconText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.error,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING['2xl'],
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
  },
  buttonText: {
    ...TYPOGRAPHY.title,
    color: COLORS.textInverse,
    fontWeight: '700',
  },
});
