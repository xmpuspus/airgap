import React, {createContext, useCallback, useContext, useState} from 'react';

// One drawer per chat screen, opened from any descendant via useSourceDrawer.
// Outside a provider, returns no-op handlers so component tests do not crash.

interface SourceDrawerCtx {
  openDocId: string | null;
  open: (docId: string) => void;
  close: () => void;
}

const SourceDrawerContext = createContext<SourceDrawerCtx | null>(null);

const NOOP: SourceDrawerCtx = {
  openDocId: null,
  open: () => {},
  close: () => {},
};

export function SourceDrawerProvider({children}: {children: React.ReactNode}) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const open = useCallback((docId: string) => setOpenDocId(docId), []);
  const close = useCallback(() => setOpenDocId(null), []);
  const value: SourceDrawerCtx = {openDocId, open, close};
  return React.createElement(SourceDrawerContext.Provider, {value}, children);
}

export function useSourceDrawer(): SourceDrawerCtx {
  return useContext(SourceDrawerContext) ?? NOOP;
}
