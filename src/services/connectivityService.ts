import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {logger} from './logger';

type ConnectivityListener = (isOnline: boolean) => void;

class ConnectivityService {
  private online = true;
  private listeners: ConnectivityListener[] = [];
  private unsubscribe: (() => void) | null = null;
  private initialized = false;

  init() {
    if (this.initialized) {
      logger.warn('Connectivity', 'Already initialized, skipping');
      return;
    }

    logger.info('Connectivity', 'Initializing network listener');

    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.online;
      this.online = !!state.isConnected && !!state.isInternetReachable;
      logger.debug('Connectivity', 'State changed', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        online: this.online,
      });
      if (wasOnline !== this.online) {
        logger.info(
          'Connectivity',
          this.online ? 'Back online' : 'Went offline',
        );
        this.listeners.forEach(fn => fn(this.online));
      }
    });

    this.initialized = true;
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners = [];
    this.initialized = false;
    logger.info('Connectivity', 'Destroyed');
  }

  isOnline(): boolean {
    if (!this.initialized) {
      logger.warn(
        'Connectivity',
        'isOnline() called before init(), returning default (true)',
      );
    }
    return this.online;
  }

  addListener(fn: ConnectivityListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  async check(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.online = !!state.isConnected && !!state.isInternetReachable;
    logger.debug('Connectivity', 'Manual check', {online: this.online});
    return this.online;
  }

  /**
   * Returns true if the active connection is Wi-Fi (or Ethernet on
   * tablets/desktops). Used to gate model updates so we never burn a
   * user's cellular data on a 2 GB GGUF download.
   */
  async isOnWiFi(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.type === 'wifi' || state.type === 'ethernet';
    } catch (err) {
      logger.warn('Connectivity', 'isOnWiFi check failed', {err: String(err)});
      return false;
    }
  }
}

export const connectivityService = new ConnectivityService();

// Initialize eagerly at module load time so the listener is active
// before any component mounts. The useEffect cleanup in App.tsx
// still calls destroy() on unmount.
connectivityService.init();
