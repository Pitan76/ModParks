"use client";

import React from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";
import { useValidationMessage } from "@/lib/i18n/validationMessage";

export interface FormTextFieldProps extends Omit<TextFieldProps, "error" | "helperText"> {
  errorMessages?: string[];
  helperText?: React.ReactNode;
  error?: boolean;
}

export default function FormTextField({ errorMessages, helperText, error, ...props }: FormTextFieldProps) {
  const resolveMessage = useValidationMessage();
  const hasError = error !== undefined ? error : (!!errorMessages && errorMessages.length > 0);
  const displayHelperText = resolveMessage(errorMessages) || helperText;

  return (
    <TextField
      {...props}
      error={hasError}
      helperText={displayHelperText}
    />
  );
}
