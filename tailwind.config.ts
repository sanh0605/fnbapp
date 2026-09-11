import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          active: "var(--color-primary-active)",
          soft: "var(--color-primary-soft)",
        },
        accent: {
          cyan: "var(--color-accent-cyan)",
        },
        page: "var(--color-bg-page)",
        surface: {
          card: "var(--color-surface-card)",
          secondary: "var(--color-surface-secondary)",
        },
        sidebar: "var(--color-sidebar)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        processing: "var(--color-processing)",
        "focus-ring": "var(--color-focus-ring)",
        "chart-profit": "var(--color-chart-profit)",
      },
      fontFamily: {
        display: ["Outfit", "Plus Jakarta Sans", "Arial", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        button: "8px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(29,42,36,.06), 0 6px 24px rgba(29,42,36,.05)",
      },
    },
  },
  plugins: [],
};
export default config;
