"use client";

import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("app_error_boundary", { error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card stack" style={{ maxWidth: 720, margin: "48px auto" }}>
            <div className="stack" style={{ gap: 10 }}>
              <h1 className="h3" style={{ margin: 0 }}>
                Došlo je do greške. Molimo osvežite stranicu.
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Ako problem ostane prisutan, pokušajte ponovo za nekoliko trenutaka.
              </p>
            </div>
            <div className="inline">
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Osvezi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
