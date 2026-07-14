import React from "react";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectProps } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import OutlinedInput from "@mui/material/OutlinedInput";

export interface FormMultiSelectOption {
  value: string;
  label: string;
}

export interface FormMultiSelectProps extends Omit<SelectProps<string[]>, "error" | "multiple"> {
  options: FormMultiSelectOption[];
  errorMessages?: string[];
  formControlProps?: FormControlProps;
  renderSelected?: (selectedValues: string[], options: FormMultiSelectOption[]) => React.ReactNode;
}

export default function FormMultiSelect({
  options,
  errorMessages,
  formControlProps,
  id,
  label,
  value = [],
  renderSelected,
  ...props
}: FormMultiSelectProps) {
  const labelId = `${id}-label`;
  const hasError = !!errorMessages && errorMessages.length > 0;
  const currentValues = Array.isArray(value) ? value : [];

  const defaultRenderValue = (selected: string[]) => {
    if (renderSelected) return renderSelected(selected, options);
    return selected.map(v => options.find(o => o.value === v)?.label || v).join(", ");
  };

  return (
    <FormControl 
      fullWidth 
      error={hasError} 
      size={props.size}
      {...formControlProps}
    >
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <Select
        labelId={label ? labelId : undefined}
        id={id}
        multiple
        value={currentValues}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => 
          renderSelected ? renderSelected(selected as string[], options) : defaultRenderValue(selected as string[])
        }
        {...props}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} id={`filter-${opt.value}`}>
            <Checkbox checked={currentValues.indexOf(opt.value) > -1} />
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
      </Select>
      {hasError && (
        <Typography color="error" variant="caption">
          {errorMessages[0]}
        </Typography>
      )}
    </FormControl>
  );
}
