import { useCallback, useEffect, useState } from "react";

import {
  desktopUpdateBridge,
  type DesktopUpdateState,
} from "../lib/desktop-update-bridge.ts";

const defaultDesktopUpdateState: DesktopUpdateState = { status: "disabled" };

export function useDesktopUpdate() {
  const [updateState, setUpdateState] = useState<DesktopUpdateState>(
    defaultDesktopUpdateState,
  );

  useEffect(() => {
    let isMounted = true;

    void desktopUpdateBridge
      .getState()
      .then((state) => {
        if (isMounted) {
          setUpdateState(state);
        }
      })
      .catch(() => undefined);

    const unsubscribe = desktopUpdateBridge.onStateChange((state) => {
      setUpdateState(state);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const installReadyUpdate = useCallback(
    () => desktopUpdateBridge.installReadyUpdate(),
    [],
  );

  return {
    installReadyUpdate,
    state: updateState,
  };
}
