import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * Makes the header's Refresh button mean what it says.
 *
 * It used to call `fetchStats()` only — the dashboard's KPI payload — so on
 * Riders, Bookings, Fleet or any other list, pressing it spun for a moment and
 * changed nothing on screen. Each page now registers its own reload here, and
 * the button runs that as well as the global stats.
 *
 * A page registers in an effect and unregisters on unmount, so the button is
 * always bound to whatever is actually being looked at.
 */

type Reload = () => void | Promise<unknown>;

interface RefreshValue {
  /** Register the current page's reload. Returns the unregister function. */
  register: (fn: Reload) => () => void;
  /** Run the page reload and the global stats fetch together. */
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshValue | null>(null);

export const RefreshProvider: React.FC<{
  /** The dashboard-wide stats fetch, always run. */
  globalReload: Reload;
  children: React.ReactNode;
}> = ({ globalReload, children }) => {
  const pageReload = useRef<Reload | null>(null);
  const globalRef = useRef(globalReload);
  globalRef.current = globalReload;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const register = useCallback((fn: Reload) => {
    pageReload.current = fn;
    return () => {
      // Only clear if this page is still the registered one — a fast route
      // change can run the old page's cleanup after the new one registered.
      if (pageReload.current === fn) pageReload.current = null;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        Promise.resolve(globalRef.current?.()),
        Promise.resolve(pageReload.current?.()),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ register, refresh, isRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
};

export function useRefresh(): RefreshValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used inside a RefreshProvider');
  return ctx;
}

/**
 * Bind this page's reload to the header button.
 *
 * Pass a stable callback (useCallback) — an inline arrow re-registers on every
 * render, which works but churns.
 */
export function usePageRefresh(reload: Reload): void {
  const { register } = useRefresh();
  React.useEffect(() => register(reload), [register, reload]);
}
