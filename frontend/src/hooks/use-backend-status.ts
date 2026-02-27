import { useEffect, useState } from "react";
import { checkHealth } from "@/api/client";

const POLL_INTERVAL_MS = 15_000;

export function useBackendStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const ok = await checkHealth();
      if (active) setConnected(ok);
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => { active = false; clearInterval(id); };
  }, []);

  return connected;
}
