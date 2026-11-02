import { loadFont as loadSans } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const sans = loadSans("normal", { weights: ["400", "700", "900"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export const colors = {
  bg: "#101012",
  panel: "#1a1a1e",
  text: "#f4f1ea",
  muted: "#9a978f",
  accent: "#ff6600", // Hacker News orange
};

// Stable color per language so a bar keeps its color while it moves.
export const languageColors: Record<string, string> = {
  Python: "#4b8bbe",
  JavaScript: "#f0db4f",
  TypeScript: "#3178c6",
  Rust: "#ff6a2b",
  Go: "#00add8",
  Java: "#e76f00",
  "C++": "#659ad2",
  Ruby: "#cc342d",
  PHP: "#8892bf",
  Swift: "#f05138",
  Haskell: "#8f4e8b",
  Clojure: "#63b132",
  "Erlang/Elixir": "#9b59b6",
  Zig: "#f7a41d",
  Kotlin: "#a97bff",
  Lisp: "#3fb68b",
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
