import type { HTMLAttributes } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
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
  error?: boolean;
  helperText?: string;
};

/**
 * Minecraft の対応ローダー（Fabric, Forge等）を複数選択するための Autocomplete コンポーネント。
 */
const LoaderAutocomplete = ({
  availablePlatforms,
  loaders,
  onChange,
  label,
  error,
  helperText
}: LoaderAutocompleteProps) => {
  const value = availablePlatforms.filter((p) => loaders.includes(p.slug));

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={availablePlatforms}
      getOptionLabel={(option: OptionItem | string) => {
        if (typeof option === "string") return option;
        return option.name || option.slug || "";
      }}
      value={value}
      onChange={(_, newValue: (OptionItem | string)[]) => {
        onChange(newValue.map((v) => (typeof v === "string" ? v : v.slug)));
      }}
      renderOption={(props: HTMLAttributes<HTMLLIElement>, option: OptionItem | string) => {
        const slug = typeof option === "string" ? option : option.slug;
        const name = typeof option === "string" ? option : option.name;
        const info = getLoaderInfo(slug);
        return (
          <li {...props} key={slug}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {info.icon}
              {name}
            </Box>
          </li>
        );
      }}
      // @ts-expect-error - MUI Autocomplete typing conflict
      renderTags={(val: (OptionItem | string)[], getTagProps) =>
        val.map((option, index: number) => {
          const slug = typeof option === "string" ? option : option.slug;
          const name = typeof option === "string" ? option : option.name;
          const info = getLoaderInfo(slug);
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              variant="outlined"
              label={name}
              size="small"
              icon={info.icon}
              color={info.color as any}
              {...tagProps}
              key={key}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          required={loaders.length === 0}
        />
      )}
    />
  );
};

export default LoaderAutocomplete;
