import Dialog from "@mui/material/Dialog";
import type { DialogProps } from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import type { DialogTitleProps } from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type AbstractDialogProps = Omit<DialogProps, "title"> & {
  title?: ReactNode;
  titleProps?: Partial<DialogTitleProps>;
  children?: ReactNode;
  actions?: ReactNode;
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
};

/**
 * プロジェクト共通で使用されるダイアログの抽象ラッパーコンポーネント。
 * 標準的なヘッダー、フッター（アクションボタン）、レイアウトを提供します。
 */
const AbstractDialog = ({
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
}: AbstractDialogProps) => {
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
};

export default AbstractDialog;
