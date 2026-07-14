import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";

export interface AbstractDialogProps extends Omit<DialogProps, "title"> {
  title?: ReactNode;
  titleProps?: any; // Additional props for DialogTitle
  children?: ReactNode;
  actions?: ReactNode;
  
  // Common action props for quick setup
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  confirmColor?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
  cancelColor?: "inherit" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
  confirmDisabled?: boolean;
  isSubmitting?: boolean;
  hideCancel?: boolean;
  hideActions?: boolean;
}

export default function AbstractDialog({
  title,
  titleProps,
  children,
  actions,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  confirmColor = "primary",
  cancelColor = "inherit",
  confirmDisabled = false,
  isSubmitting = false,
  hideCancel = false,
  hideActions = false,
  ...props
}: AbstractDialogProps) {
  const tCommon = useTranslations("Common");

  const renderActions = () => {
    if (hideActions) return null;
    if (actions) return actions;

    return (
      <>
        {!hideCancel && (
          <Button 
            onClick={onCancel || ((e) => props.onClose?.(e, "escapeKeyDown"))} 
            variant="outlined" 
            color={cancelColor}
            disabled={isSubmitting}
          >
            {cancelText || tCommon("cancel")}
          </Button>
        )}
        {onConfirm && (
          <Button 
            onClick={onConfirm} 
            variant="contained" 
            color={confirmColor} 
            disabled={confirmDisabled || isSubmitting}
            sx={{ fontWeight: "bold" }}
          >
            {confirmText || tCommon("save")}
          </Button>
        )}
      </>
    );
  };

  return (
    <Dialog {...props}>
      {title && <DialogTitle {...titleProps}>{title}</DialogTitle>}
      <DialogContent>
        {children}
      </DialogContent>
      {!hideActions && (
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {renderActions()}
        </DialogActions>
      )}
    </Dialog>
  );
}
