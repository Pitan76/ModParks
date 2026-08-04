import { useTranslations } from "next-intl";
import MultiChipAutocomplete from "@/components/ui/form/MultiChipAutocomplete";

type OptionItem = {
  slug: string;
  name: string;
};

export type TagAutocompleteProps = {
  availableTags: OptionItem[];
  tags: string[];
  onChange: (tags: string[]) => void;
  label: string;
  placeholder?: string;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

/**
 * タグの複数選択。候補に無いタグも自由に追加でき、`,` 区切りでまとめて入力できる。
 */
export default function TagAutocomplete({
  availableTags,
  tags,
  onChange,
  ...props
}: TagAutocompleteProps) {
  const tTags = useTranslations("Tags");

  return (
    <MultiChipAutocomplete
      {...props}
      options={availableTags.map((tag) => tag.slug)}
      value={tags}
      onChange={onChange}
      getLabel={(slug) => {
        if (tTags.has(slug as never)) return tTags(slug as never);
        return availableTags.find((tag) => tag.slug === slug)?.name || slug;
      }}
      expandInput={(raw) =>
        raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      }
    />
  );
}
