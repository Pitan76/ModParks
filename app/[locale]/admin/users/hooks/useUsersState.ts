import { useState } from "react";
import type { User } from "../UsersClient";
import { updateUserRole, deleteUser, updateUsernameByAdmin, purgeDeletedUsers, hardDeleteUser } from "@/lib/actions/admin";
import { useTranslations } from "next-intl";

/**
 * ユーザー管理画面のステートとイベントハンドラを管理するカスタムフック
 * @param users ユーザー一覧データ
 */
export function useUsersState(users: User[]) {
  const tAdmin = useTranslations("Admin.users");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);

  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeUsers = users.filter((u) => !u.deletedAt);
  const deletedUsers = users.filter((u) => u.deletedAt);
  const displayedUsers = tabIndex === 0 ? activeUsers : deletedUsers;

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
    tabIndex,
    setTabIndex,
    detailsDialogOpen,
    setDetailsDialogOpen,
    detailsUser,
    setDetailsUser,
    deleteUserTarget,
    setDeleteUserTarget,
    isDeleting,
    activeUsers,
    deletedUsers,
    displayedUsers,
    handleRoleChange,
    handleDeleteUser,
    handleHardDeleteUser,
    handlePurgeDeletedUsers,
    handleOpenEditDialog,
    handleSaveUsername,
  };
}
