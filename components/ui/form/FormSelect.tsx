import React from "react";
import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectProps } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

export interface FormSelectOption {
  value: string;
  label: React.ReactNode;
}

export interface FormSelectProps extends Omit<SelectProps, "error"> {
  options: FormSelectOption[];
  errorMessages?: string[];
  formControlProps?: FormControlProps;
}

export default function FormSelect({ 
  options, 
  errorMessages, 
  formControlProps, 
  id, 
  label, 
  ...props 
}: FormSelectProps) {
  const labelId = `${id}-label`;
  const hasError = !!errorMessages && errorMessages.length > 0;

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
        label={label}
        {...props}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
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
