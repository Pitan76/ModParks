import { useState } from "react";
import type { User } from "../UsersClient";
import { updateUserRole, deleteUser, updateUsernameByAdmin, purgeDeletedUsers, hardDeleteUser, toggleUserSuspension, grantPremium, revokePremium } from "@/lib/actions/admin";
import { useTranslations } from "next-intl";

/**
 * ユーザー管理画面のステートとイベントハンドラを管理するカスタムフック
 */
export function useUsersState() {
  const tAdmin = useTranslations("Admin.users");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);

  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);

  const [premiumTarget, setPremiumTarget] = useState<User | null>(null);
  // 空文字は無期限
  const [premiumDuration, setPremiumDuration] = useState("");
  const [isPremiumSaving, setIsPremiumSaving] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      await updateUserRole(userId, newRole);
      showMessage("success", tAdmin("successUpdate", { role: newRole === "admin" ? tAdmin("roleAdmin") : tAdmin("roleUser") }));
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setIsDeleting(true);
    try {
      await deleteUser(deleteUserTarget.id);
      showMessage("success", tAdmin("successDeleteUser"));
      setDeleteUserTarget(null);
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSuspension = async (userId: string) => {
    setIsSuspending(true);
    try {
      const res = await toggleUserSuspension(userId);
      showMessage("success", res.suspended ? tAdmin("successSuspend") : tAdmin("successUnsuspend"));
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsSuspending(false);
    }
  };

  const handleHardDeleteUser = async (userId: string) => {
    // ---- 日本語でブラウザ標準確認ダイアログを表示するため、翻訳リソースから取得 ----
    if (!confirm(tAdmin("deleteConfirmGhost"))) return;
    try {
      await hardDeleteUser(userId);
      showMessage("success", tAdmin("successDeleteGhost"));
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const handlePurgeDeletedUsers = async () => {
    // ---- 日本語でブラウザ標準確認ダイアログを表示するため、翻訳リソースから取得 ----
    if (!confirm(tAdmin("purgeConfirm"))) return;
    setIsPurging(true);
    try {
      await purgeDeletedUsers();
      showMessage("success", tAdmin("successPurge"));
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const handleOpenPremiumDialog = (user: User) => {
    setPremiumTarget(user);
    setPremiumDuration("");
  };

  const handleGrantPremium = async () => {
    if (!premiumTarget) return;
    setIsPremiumSaving(true);
    try {
      await grantPremium(premiumTarget.id, premiumDuration ? Number(premiumDuration) : null);
      showMessage("success", tAdmin("successPremiumGrant"));
      setPremiumTarget(null);
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsPremiumSaving(false);
    }
  };

  const handleRevokePremium = async () => {
    if (!premiumTarget) return;
    setIsPremiumSaving(true);
    try {
      await revokePremium(premiumTarget.id);
      showMessage("success", tAdmin("successPremiumRevoke"));
      setPremiumTarget(null);
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsPremiumSaving(false);
    }
  };

  const handleOpenEditDialog = (user: User) => {
    setEditUserId(user.id);
    setEditUsername(user.username || "");
    setEditDialogOpen(true);
  };

  const handleSaveUsername = async () => {
    if (!editUsername) return;
    setIsEditing(true);
    try {
      await updateUsernameByAdmin(editUserId, editUsername);
      showMessage("success", tAdmin("successUpdateUsername"));
      setEditDialogOpen(false);
    } catch (err: any) {
      showMessage("error", err.message);
    } finally {
      setIsEditing(false);
    }
  };

  return {
    msg,
    editDialogOpen,
    setEditDialogOpen,
    editUsername,
    setEditUsername,
    isEditing,
    isPurging,
    detailsDialogOpen,
    setDetailsDialogOpen,
    detailsUser,
    setDetailsUser,
    deleteUserTarget,
    setDeleteUserTarget,
    isDeleting,
    handleRoleChange,
    handleDeleteUser,
    handleHardDeleteUser,
    handlePurgeDeletedUsers,
    handleOpenEditDialog,
    handleSaveUsername,
    handleToggleSuspension,
    isSuspending,
    premiumTarget,
    setPremiumTarget,
    premiumDuration,
    setPremiumDuration,
    isPremiumSaving,
    handleOpenPremiumDialog,
    handleGrantPremium,
    handleRevokePremium,
  };
}
