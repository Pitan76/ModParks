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
import { updateUserRole, deleteUser, updateUsernameByAdmin, purgeDeletedUsers } from "@/lib/actions/admin";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";

export interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: Date | number;
}
export default function UsersClient({ users }: { users: User[] }) {
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const tAdmin = useTranslations("Admin.users");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      await updateUserRole(userId, newRole);
      setMsg({ type: "success", text: tAdmin("successUpdate", { role: newRole === "admin" ? tAdmin("roleAdmin") : tAdmin("roleUser") }) });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    try {
      await deleteUser(userId);
      setMsg({ type: "success", text: "User successfully deleted" });
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
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Manage your users here.
        </Typography>
        <Button 
          variant="outlined" 
          color="error" 
          startIcon={<DeleteIcon />} 
          onClick={handlePurgeDeletedUsers}
          disabled={isPurging}
        >
          幽霊アカウントを物理削除
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
            {users.map((user) => {
              const joinedDate = new Date(typeof user.createdAt === "number" ? user.createdAt * 1000 : user.createdAt);
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar src={user.avatarUrl || undefined} sx={{ width: 32, height: 32 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
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
                    >
                      <MenuItem value="user">{tAdmin("roleUser")}</MenuItem>
                      <MenuItem value="admin">{tAdmin("roleAdmin")}</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <IconButton color="primary" onClick={() => handleOpenEditDialog(user)} title="Edit User ID">
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteUser(user.id)} title="Delete User">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
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
    </Box>
  );
}
