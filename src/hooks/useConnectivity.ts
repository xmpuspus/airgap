import {useState, useEffect, useRef, useCallback} from 'react';
import NetInfo, {NetInfoStateType} from '@react-native-community/netinfo';

interface ConnectivityState {
  isOnline: boolean;
  connectionType: string;
}

type StatusChangeCallback = (isOnline: boolean) => void;

export function useConnectivity(onStatusChange?: StatusChangeCallback) {
  const [state, setState] = useState<ConnectivityState>({
    isOnline: true,
    connectionType: 'unknown',
  });
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const previousOnline = useRef(true);

  const handleNetChange = useCallback(
    (netState: {isConnected: boolean | null; type: NetInfoStateType}) => {
      const online = netState.isConnected ?? false;
      const type = netState.type;

      setState({isOnline: online, connectionType: type});

      if (previousOnline.current !== online) {
        previousOnline.current = online;
        callbackRef.current?.(online);
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetChange);
    return () => unsubscribe();
  }, [handleNetChange]);

  return state;
}
