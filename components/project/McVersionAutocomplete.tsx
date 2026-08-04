import MultiChipAutocomplete from "@/components/ui/form/MultiChipAutocomplete";
import { MC_VERSIONS } from "@/lib/data/minecraftVersions";
import { expandMcVersionInput } from "@/lib/data/mcVersionQuery";

const OPTIONS = MC_VERSIONS as unknown as string[];

export type McVersionAutocompleteProps = {
  value: string[];
  onChange: (mcVersions: string[]) => void;
  label: string;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

/**
 * Minecraft バージョンの複数選択。
 * `1.18.*` `1.19-1.19.2` `1.18,1.19` といった手動入力を展開する（→ mcVersionQuery）。
 */
export default function McVersionAutocomplete(props: McVersionAutocompleteProps) {
  return (
    <MultiChipAutocomplete
      {...props}
      options={OPTIONS}
      expandInput={(raw) => expandMcVersionInput(raw, OPTIONS)}
      placeholder="1.18.*, 1.19-1.19.2"
    />
  );
}
