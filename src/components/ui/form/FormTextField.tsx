import React from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";

export interface FormTextFieldProps extends Omit<TextFieldProps, "error" | "helperText"> {
  errorMessages?: string[];
  helperText?: React.ReactNode;
  error?: boolean;
}

export default function FormTextField({ errorMessages, helperText, error, ...props }: FormTextFieldProps) {
  const hasError = error !== undefined ? error : (!!errorMessages && errorMessages.length > 0);
  const displayHelperText = errorMessages?.[0] || helperText;

  return (
    <TextField
      {...props}
      error={hasError}
      helperText={displayHelperText}
    />
  );
}
