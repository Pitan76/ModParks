import type { ReactElement } from "react";
import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip, { type ChipProps } from "@mui/material/Chip";
import Box from "@mui/material/Box";

export type MultiChipOptionDecoration = {
  icon?: ReactElement;
  color?: ChipProps["color"];
};

export type MultiChipAutocompleteProps = {
  /** 選択肢（値の配列）。表示名は getLabel で解決する。 */
  options: readonly string[];
  value: string[];
  onChange: (values: string[]) => void;
  label: string;
  /** 値 → 表示名。省略時は値をそのまま表示。 */
  getLabel?: (value: string) => string;
  /** 値 → Chip / 候補行に付けるアイコンと色。 */
  getDecoration?: (value: string) => MultiChipOptionDecoration;
  /**
   * 手動入力を値の配列へ展開する関数。渡すと freeSolo になる。
   * 展開できない入力には空配列を返すこと。
   */
  expandInput?: (raw: string) => string[];
  placeholder?: string;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

/**
 * 値が文字列の複数選択 Autocomplete。
 * 選択済みは候補から隠し（Chip の × で戻る）、expandInput を渡すと手動入力にも対応する。
 */
export default function MultiChipAutocomplete({
  options,
  value,
  onChange,
  label,
  getLabel,
  getDecoration,
  expandInput,
  placeholder,
  size,
  error,
  helperText,
  required
}: MultiChipAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");

  function labelOf(item: string) {
    return getLabel ? getLabel(item) : item;
  }

  /**
   * 入力由来の値も含めて重複なしに正規化する。
   * 候補にある値は options の並び順、候補に無い値（自由入力タグ等）はその後ろへ入力順で並べる。
   */
  function commit(nextValues: readonly string[]) {
    const picked = new Set<string>();
    for (const item of nextValues) {
      if (options.includes(item)) {
        picked.add(item);
        continue;
      }
      expandInput?.(item).forEach((v) => picked.add(v));
    }
    const known = options.filter((v) => picked.has(v));
    const extra = [...picked].filter((v) => !options.includes(v));
    onChange([...known, ...extra]);
  }

  return (
    <Autocomplete
      multiple
      freeSolo={!!expandInput}
      disableCloseOnSelect
      filterSelectedOptions
      options={options as string[]}
      value={value}
      inputValue={inputValue}
      getOptionLabel={(option) => labelOf(option as string)}
      onInputChange={(_, next, reason) => {
        if (reason === "reset" || reason === "clear") {
          setInputValue("");
          return;
        }
        // `,` が入力された時点で確定させる（"1.18,1.19," のような連続入力向け）。
        // 空白は確定に使わない（タグ名に空白が含まれ得るため）。
        if (expandInput && next.endsWith(",")) {
          const expanded = expandInput(next);
          if (expanded.length > 0) {
            commit([...value, ...expanded]);
            setInputValue("");
            return;
          }
        }
        setInputValue(next);
      }}
      onChange={(_, newValue) => commit(newValue as string[])}
      renderOption={(props, option) => {
        const item = option as string;
        const decoration = getDecoration?.(item);
        const { key, ...liProps } = props;
        return (
          <li key={key} {...liProps}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {decoration?.icon}
              {labelOf(item)}
            </Box>
          </li>
        );
      }}
      renderValue={(val, getItemProps) =>
        (val as string[]).map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          const decoration = getDecoration?.(option);
          return (
            <Chip
              variant="outlined"
              size="small"
              label={labelOf(option)}
              icon={decoration?.icon}
              color={decoration?.color}
              {...itemProps}
              key={key}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          required={required ?? value.length === 0}
        />
      )}
    />
  );
}
