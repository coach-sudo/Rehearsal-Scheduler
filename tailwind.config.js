/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        panel: "#f7f8f4",
        line: "#d9dfd3",
        moss: "#51735f",
        coral: "#c7624f",
        amber: "#d79d3f",
        sky: "#5f86a6"
      },
    },
  },
  plugins: [],
};
