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
          DEFAULT: "rgb(var(--color-primary-rgb) / <alpha-value>)",
          hover: "rgb(var(--color-primary-hover-rgb) / <alpha-value>)",
          active: "rgb(var(--color-primary-active-rgb) / <alpha-value>)",
          soft: "rgb(var(--color-primary-soft-rgb) / <alpha-value>)",
        },
        page: "rgb(var(--color-bg-page-rgb) / <alpha-value>)",
        surface: {
          card: "rgb(var(--color-surface-card-rgb) / <alpha-value>)",
          secondary: "rgb(var(--color-surface-secondary-rgb) / <alpha-value>)",
        },
        sidebar: "rgb(var(--color-sidebar-rgb) / <alpha-value>)",
        "text-primary": "rgb(var(--color-text-primary-rgb) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb) / <alpha-value>)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        processing: "rgb(var(--color-processing-rgb) / <alpha-value>)",
        "focus-ring": "rgb(var(--color-focus-ring-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-app)", "Arial", "sans-serif"],
        display: ["var(--font-app)", "Arial", "sans-serif"],
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
