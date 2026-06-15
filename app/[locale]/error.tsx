"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Local Error Caught:", error);
  }, [error]);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "red" }}>Something went wrong!</h2>
      <p>We caught an error that crashed the page.</p>
      <pre style={{ background: "#eee", padding: "20px", overflowX: "auto", color: "black", whiteSpace: "pre-wrap" }}>
        {error.name}: {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        style={{ padding: "10px 20px", marginTop: "20px", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
