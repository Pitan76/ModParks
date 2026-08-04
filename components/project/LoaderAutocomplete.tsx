import MultiChipAutocomplete from "@/components/ui/form/MultiChipAutocomplete";
import { getLoaderInfo } from "@/lib/loaders";

type OptionItem = {
  slug: string;
  name: string;
};

export type LoaderAutocompleteProps = {
  availablePlatforms: OptionItem[];
  loaders: string[];
  onChange: (loaders: string[]) => void;
  label: string;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

/**
 * Minecraft の対応ローダー（Fabric, Forge等）を複数選択する。
 */
export default function LoaderAutocomplete({
  availablePlatforms,
  loaders,
  onChange,
  ...props
}: LoaderAutocompleteProps) {
  return (
    <MultiChipAutocomplete
      {...props}
      options={availablePlatforms.map((p) => p.slug)}
      value={loaders}
      onChange={onChange}
      getLabel={(slug) => availablePlatforms.find((p) => p.slug === slug)?.name || slug}
      getDecoration={(slug) => {
        const info = getLoaderInfo(slug);
        return { icon: info.icon, color: info.color };
      }}
    />
  );
}
