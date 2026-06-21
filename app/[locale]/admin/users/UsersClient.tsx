"use client";

import { useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { updateUserRole, deleteUser, updateUsernameByAdmin, purgeDeletedUsers, hardDeleteUser } from "@/lib/actions/admin";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import { Link } from "@/i18n/routing";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useTranslations } from "next-intl";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";

export interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: Date | number;
  deletedAt: Date | null;
  twoFactorEnabled?: boolean;
  hasGithub?: boolean;
}
export default function UsersClient({ users }: { users: User[] }) {
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const tAdmin = useTranslations("Admin.users");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);

  const activeUsers = users.filter((u) => !u.deletedAt);
  const deletedUsers = users.filter((u) => u.deletedAt);
  const displayedUsers = tabIndex === 0 ? activeUsers : deletedUsers;

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      await updateUserRole(userId, newRole);
      setMsg({ type: "success", text: tAdmin("successUpdate", { role: newRole === "admin" ? tAdmin("roleAdmin") : tAdmin("roleUser") }) });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setIsDeleting(true);
    try {
      await deleteUser(deleteUserTarget.id);
      setMsg({ type: "success", text: "User successfully deleted" });
      setDeleteUserTarget(null);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleHardDeleteUser = async (userId: string) => {
    if (!confirm("この幽霊アカウントを物理削除しますか？\n（この操作は取り消せません）")) return;
    try {
      await hardDeleteUser(userId);
      setMsg({ type: "success", text: "Ghost account permanently deleted" });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const handlePurgeDeletedUsers = async () => {
    if (!confirm("完全に削除された「幽霊アカウント（退会済みユーザー）」をデータベースから物理削除しますか？\n（この操作は取り消せません。メールアドレスが完全に解放されます）")) return;
    setIsPurging(true);
    try {
      await purgeDeletedUsers();
      setMsg({ type: "success", text: "Ghost accounts purged successfully" });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsPurging(false);
      setTimeout(() => setMsg(null), 3000);
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
      setMsg({ type: "success", text: "User ID updated successfully" });
      setEditDialogOpen(false);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsEditing(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "flex-end" }}>
        <Tabs value={tabIndex} onChange={(_, newVal) => setTabIndex(newVal)}>
          <Tab label={`Active Users (${activeUsers.length})`} />
          <Tab label={`Ghost Accounts (${deletedUsers.length})`} />
        </Tabs>
        <Button 
          variant="outlined" 
          color="error" 
          startIcon={<DeleteIcon />} 
          onClick={handlePurgeDeletedUsers}
          disabled={isPurging || deletedUsers.length === 0}
        >
          すべての幽霊アカウントを物理削除
        </Button>
      </Box>
      
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{tAdmin("user")}</TableCell>
              <TableCell>{tAdmin("email")}</TableCell>
              <TableCell>{tAdmin("joined")}</TableCell>
              <TableCell>{tAdmin("role")}</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedUsers.map((user) => {
              const joinedDate = new Date(typeof user.createdAt === "number" ? user.createdAt * 1000 : user.createdAt);
              return (
                <TableRow key={user.id} sx={{ opacity: user.deletedAt ? 0.5 : 1 }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar src={user.avatarUrl || undefined} sx={{ width: 32, height: 32 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: "bold", textDecoration: user.deletedAt ? "line-through" : "none" }}>
                          {user.displayName || user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.username ? `@${user.username}` : "(ID未設定)"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email || "N/A"}</TableCell>
                  <TableCell>{joinedDate.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      size="small"
                      onChange={(e) => handleRoleChange(user.id, e.target.value as "user" | "admin")}
                      sx={{ minWidth: 120 }}
                      disabled={!!user.deletedAt}
                    >
                      <MenuItem value="user">{tAdmin("roleUser")}</MenuItem>
                      <MenuItem value="admin">{tAdmin("roleAdmin")}</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {!user.deletedAt ? (
                      <>
                        <IconButton color="info" onClick={() => { setDetailsUser(user); setDetailsDialogOpen(true); }} title="View User Info">
                          <InfoIcon />
                        </IconButton>
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(user)} title="Edit User ID">
                          <EditIcon />
                        </IconButton>
                        <IconButton color="error" onClick={() => setDeleteUserTarget(user)} title="Delete User">
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <Button color="error" size="small" onClick={() => handleHardDeleteUser(user.id)}>
                        Hard Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {displayedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No users found in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User ID</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Changing the User ID (username) will update their profile URL.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="New User ID"
            value={editUsername}
            onChange={(e) => setEditUsername(e.target.value)}
            disabled={isEditing}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isEditing} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSaveUsername} disabled={isEditing || !editUsername} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <TypedConfirmDialog
        open={!!deleteUserTarget}
        onClose={() => !isDeleting && setDeleteUserTarget(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        description={<>Are you sure you want to delete the user <strong>{deleteUserTarget?.displayName || deleteUserTarget?.username}</strong>? This cannot be undone.</>}
        expectedValue={deleteUserTarget?.username || deleteUserTarget?.id || ""}
        expectedValueLabel="Please type the username to confirm:"
        pending={isDeleting}
      />

      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>User Information</DialogTitle>
        <DialogContent>
          {detailsUser && (
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell variant="head" sx={{ width: "35%", fontWeight: "bold" }}>ID</TableCell>
                  <TableCell>{detailsUser.id}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Username</TableCell>
                  <TableCell>@{detailsUser.username || "N/A"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Display Name</TableCell>
                  <TableCell>{detailsUser.displayName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Email</TableCell>
                  <TableCell>{detailsUser.email}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Profile Link</TableCell>
                  <TableCell>
                    {detailsUser.username ? (
                      <Link href={`/profile/${detailsUser.username}`} style={{ color: "#1976d2" }} target="_blank">
                        View Profile
                      </Link>
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Account Created</TableCell>
                  <TableCell>{new Date(typeof detailsUser.createdAt === "number" ? detailsUser.createdAt * 1000 : detailsUser.createdAt).toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>2FA Enabled</TableCell>
                  <TableCell>{detailsUser.twoFactorEnabled ? "Yes" : "No"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>GitHub Linked</TableCell>
                  <TableCell>{detailsUser.hasGithub ? "Yes" : "No"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant="head" sx={{ fontWeight: "bold" }}>Deleted Status</TableCell>
                  <TableCell>{detailsUser.deletedAt ? new Date(detailsUser.deletedAt).toLocaleString() : "Active"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
