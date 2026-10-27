
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("CivicEco rendering error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <section style={{ maxWidth: "480px" }}>
            <h1>Something went wrong</h1>

            <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
              CivicEco couldn't display this page. You can try again or
              reload the application.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "11px 16px",
                margin: "8px",
                border: 0,
                borderRadius: "9px",
                background: "#4f46e5",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: "inline-block",
                padding: "11px 16px",
                margin: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "9px",
                background: "transparent",
                textDecoration: "none",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Reload CivicEco
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
