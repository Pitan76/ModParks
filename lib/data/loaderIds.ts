/**
 * Mod/Plugin ローダーの定義データ。
 *
 * React / MUI に依存しない純粋データとして独立させている。
 * アイコン付きの表示用定義は lib/loaders.tsx がこれを元に組み立てる。
 * workers/anvil 側からも参照するため、ここに副作用や外部 import を持ち込まないこと。
 */
export type LoaderColor =
  | "default" | "primary" | "secondary" | "warning" | "error" | "info" | "success";

export const LOADERS_DATA: { id: string; name: string; color: LoaderColor }[] = [
  { id: "fabric",    name: "Fabric",    color: "primary"   },
  { id: "forge",     name: "Forge",     color: "warning"   },
  { id: "neoforge",  name: "NeoForge",  color: "warning"   },
  { id: "quilt",     name: "Quilt",     color: "secondary" },
  { id: "spigot",    name: "Spigot",    color: "default"   },
  { id: "paper",     name: "Paper",     color: "default"   },
  { id: "purpur",    name: "Purpur",    color: "default"   },
  { id: "velocity",  name: "Velocity",  color: "info"      },
  { id: "waterfall", name: "Waterfall", color: "info"      },
];

export const AVAILABLE_LOADERS = LOADERS_DATA.map((l) => l.id);
