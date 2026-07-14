import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ModParks",
    short_name: "ModParks",
    description: "Minecraft Java Edition向けのMOD/プラグインを簡単に公開、検索、ダウンロードできる日本発プラットフォーム",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
