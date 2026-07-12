import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const { loginWithGoogle } = useAuth();
  const divRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    async function handleCredential(response: { credential: string }) {
      try {
        await loginWithGoogle(response.credential);
      } catch (err) {
        onError(err instanceof ApiError ? err.message : "Google sign-in failed. Try again.");
      }
    }

    function tryInit() {
      if (!window.google || !divRef.current) return false;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID!, callback: handleCredential });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: "filled_black",
        size: "large",
        width: divRef.current.clientWidth || 360,
        shape: "rectangular",
        text: "continue_with",
      });
      setReady(true);
      return true;
    }

    if (tryInit()) return;
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
        Google sign-in isn't configured (missing VITE_GOOGLE_CLIENT_ID).
      </p>
    );
  }

  return <div ref={divRef} style={{ display: "flex", justifyContent: "center", minHeight: ready ? undefined : 40 }} />;
}
