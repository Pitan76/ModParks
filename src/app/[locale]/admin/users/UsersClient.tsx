"use client";

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
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import { useUsersState } from "./hooks/useUsersState";
import UserDetailsDialog from "./components/UserDetailsDialog";
import UserEditDialog from "./components/UserEditDialog";
import PremiumDialog from "./components/PremiumDialog";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { getPremiumState } from "@/lib/premium";
import { tableContainerSx, tableHeadSx, tableRootSx, TABLE_MIN_WIDTH } from "@/components/ui/tableStyles";

export interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: Date | number;
  deletedAt: Date | null;
  deactivatedAt: Date | null;
  suspendedAt: Date | null;
  twoFactorEnabled?: boolean;
  hasGithub?: boolean;
  premiumTier?: string | null;
  premiumUntil?: Date | number | null;
}

/**
 * システム管理画面のユーザー一覧コンポーネント
 */
export default function UsersClient({ users }: { users: User[] }) {
  const tAdmin = useTranslations("Admin.users");
  const {
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
  } = useUsersState(users);
  const { data: session } = useSession();

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "space-between", mb: 2, alignItems: { xs: "stretch", sm: "flex-end" } }}>
        <Tabs value={tabIndex} onChange={(_, newVal) => setTabIndex(newVal)}>
          <Tab label={tAdmin("activeUsers", { count: activeUsers.length })} />
          <Tab label={tAdmin("ghostUsers", { count: deletedUsers.length })} />
        </Tabs>
        <Button 
          variant="outlined" 
          color="error" 
          startIcon={<DeleteIcon />} 
          onClick={handlePurgeDeletedUsers}
          disabled={isPurging || deletedUsers.length === 0}
        >
          {tAdmin("btnPurgeAll")}
        </Button>
      </Box>
      
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <TableContainer component={Paper} sx={tableContainerSx}>
        <Table size="small" sx={[tableRootSx, { minWidth: TABLE_MIN_WIDTH }]}>
          <TableHead sx={tableHeadSx}>
            <TableRow>
              <TableCell>{tAdmin("user")}</TableCell>
              <TableCell>{tAdmin("email")}</TableCell>
              <TableCell>{tAdmin("joined")}</TableCell>
              <TableCell>{tAdmin("role")}</TableCell>
              <TableCell>{tAdmin("actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedUsers.map((user) => {
              const joinedDate = new Date(typeof user.createdAt === "number" ? user.createdAt * 1000 : user.createdAt);
              return (
                <TableRow key={user.id} hover sx={{ opacity: user.deletedAt ? 0.5 : 1 }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar src={user.avatarUrl || undefined} sx={{ width: 32, height: 32 }} />
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ fontWeight: "bold", textDecoration: user.deletedAt ? "line-through" : "none" }}>
                            {user.displayName || user.username}
                          </Typography>
                          {user.suspendedAt && (
                            <Chip label={tAdmin("statusSuspended")} size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                          )}
                          {getPremiumState(user) === "active" && (
                            <Chip label={tAdmin("premiumLabel")} size="small" color="warning" sx={{ height: 20, fontSize: "0.7rem" }} />
                          )}
                          {user.deactivatedAt && (
                            <Chip label={tAdmin("statusDeactivated")} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {user.username ? `@${user.username}` : tAdmin("noUsername")}
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
                      disabled={!!user.deletedAt || !!user.suspendedAt || !!user.deactivatedAt}
                    >
                      <MenuItem value="user">{tAdmin("roleUser")}</MenuItem>
                      <MenuItem value="admin">{tAdmin("roleAdmin")}</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {!user.deletedAt ? (
                      <>
                        <IconButton color="info" onClick={() => { setDetailsUser(user); setDetailsDialogOpen(true); }} title={tAdmin("btnViewInfo")}>
                          <InfoIcon />
                        </IconButton>
                        <IconButton color="primary" onClick={() => handleOpenEditDialog(user)} title={tAdmin("btnEditId")} disabled={!!user.suspendedAt || !!user.deactivatedAt}>
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color={getPremiumState(user) === "active" ? "warning" : "default"}
                          onClick={() => handleOpenPremiumDialog(user)}
                          title={tAdmin("btnPremium")}
                          disabled={!!user.suspendedAt || !!user.deactivatedAt}
                        >
                          <WorkspacePremiumIcon />
                        </IconButton>
                        <IconButton
                          color={user.suspendedAt ? "success" : "warning"}
                          onClick={() => handleToggleSuspension(user.id)} 
                          title={user.suspendedAt ? tAdmin("btnUnsuspend") : tAdmin("btnSuspend")}
                          disabled={user.id === session?.user?.id || isSuspending}
                        >
                          {user.suspendedAt ? <CheckCircleIcon /> : <BlockIcon />}
                        </IconButton>
                        <IconButton color="error" onClick={() => setDeleteUserTarget(user)} title={tAdmin("btnDelete")} disabled={!!user.suspendedAt || !!user.deactivatedAt}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <Button color="error" size="small" onClick={() => handleHardDeleteUser(user.id)}>
                        {tAdmin("btnHardDelete")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {displayedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  {tAdmin("noUsersFound")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <UserEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        username={editUsername}
        onChangeUsername={setEditUsername}
        onSave={handleSaveUsername}
        pending={isEditing}
      />

      <TypedConfirmDialog
        open={!!deleteUserTarget}
        onClose={() => !isDeleting && setDeleteUserTarget(null)}
        onConfirm={handleDeleteUser}
        title={tAdmin("deleteUserTitle")}
        description={tAdmin.rich("deleteUserConfirm", {
          name: deleteUserTarget?.displayName || deleteUserTarget?.username || "",
          bold: (chunks) => <strong>{chunks}</strong>,
        })}
        expectedValue={deleteUserTarget?.username || deleteUserTarget?.id || ""}
        expectedValueLabel={tAdmin("deleteUserExpectedLabel")}
        pending={isDeleting}
      />

      <PremiumDialog
        open={!!premiumTarget}
        onClose={() => !isPremiumSaving && setPremiumTarget(null)}
        user={premiumTarget}
        duration={premiumDuration}
        onChangeDuration={setPremiumDuration}
        onGrant={handleGrantPremium}
        onRevoke={handleRevokePremium}
        pending={isPremiumSaving}
      />

      <UserDetailsDialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        user={detailsUser}
      />
    </Box>
  );
}

