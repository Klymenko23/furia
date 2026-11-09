import type { MetadataRoute } from "next";

// Потрібен, щоб на iPhone Furia можна було додати на екран «Додому» і отримувати пуші
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Furia",
    short_name: "Furia",
    description: "Рейси, автопарк, водії й витрати перевізника",
    start_url: "/",
    display: "standalone",
    background_color: "#141210",
    theme_color: "#d9480f",
    lang: "uk",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
