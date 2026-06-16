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
import { updateUserRole, deleteUser } from "@/lib/actions/admin";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
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

  return (
    <Box>
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
                        <Typography variant="body2" fontWeight="bold">
                          {user.displayName || user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
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
                    <IconButton color="error" onClick={() => handleDeleteUser(user.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
