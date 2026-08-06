import Autocomplete, { AutocompleteProps } from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

export interface FormAutocompleteProps<T, Multiple extends boolean | undefined, DisableClearable extends boolean | undefined, FreeSolo extends boolean | undefined> 
  extends Omit<AutocompleteProps<T, Multiple, DisableClearable, FreeSolo>, "renderInput"> {
  label?: string;
  placeholder?: string;
  errorMessages?: string[];
  renderInputProps?: any;
}

export default function FormAutocomplete<T, Multiple extends boolean | undefined, DisableClearable extends boolean | undefined, FreeSolo extends boolean | undefined>({
  label,
  placeholder,
  errorMessages,
  renderInputProps,
  filterSelectedOptions,
  ...props
}: FormAutocompleteProps<T, Multiple, DisableClearable, FreeSolo>) {
  return (
    <Autocomplete
      {...props}
      // 複数選択では選択済みを候補から隠す（チップの × で戻る）
      filterSelectedOptions={filterSelectedOptions ?? !!props.multiple}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          error={!!errorMessages && errorMessages.length > 0}
          helperText={errorMessages?.[0]}
          {...renderInputProps}
        />
      )}
    />
  );
}
