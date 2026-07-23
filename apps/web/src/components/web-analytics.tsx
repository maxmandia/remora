import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import { syncWebAnalyticsLocation } from "../lib/analytics";

export function WebAnalytics() {
  const location = useLocation({
    select: ({ href, pathname, searchStr }) => ({
      href,
      pathname,
      search: searchStr,
    }),
  });

  useEffect(() => {
    void syncWebAnalyticsLocation(location);
  }, [location]);

  return null;
}
