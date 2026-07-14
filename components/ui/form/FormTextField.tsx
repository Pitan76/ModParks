import React from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";

export interface FormTextFieldProps extends Omit<TextFieldProps, "error" | "helperText"> {
  errorMessages?: string[];
  helperText?: React.ReactNode;
}

export default function FormTextField({ errorMessages, helperText, ...props }: FormTextFieldProps) {
  return (
    <TextField
      {...props}
      error={!!errorMessages && errorMessages.length > 0}
      helperText={errorMessages?.[0] || helperText}
    />
  );
}
