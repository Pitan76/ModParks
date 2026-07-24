import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import type { User } from "../UsersClient";

interface UserDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

/**
 * ユーザーの詳細情報を表示するモーダルダイアログ
 */
export default function UserDetailsDialog({ open, onClose, user }: UserDetailsDialogProps) {
  const tAdmin = useTranslations("Admin.users");

  if (!user) return null;

  const joinedDate = new Date(typeof user.createdAt === "number" ? user.createdAt * 1000 : user.createdAt);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{tAdmin("detailsTitle")}</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell variant="head" sx={{ width: "35%", fontWeight: "bold" }}>
                {tAdmin("detailsId")}
              </TableCell>
              <TableCell>{user.id}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsUsername")}
              </TableCell>
              <TableCell>@{user.username || "N/A"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsDisplayName")}
              </TableCell>
              <TableCell>{user.displayName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsEmail")}
              </TableCell>
              <TableCell>{user.email}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsProfileLink")}
              </TableCell>
              <TableCell>
                {user.username ? (
                  <Link href={`/profile/${user.username}`} style={{ color: "#1976d2" }} target="_blank">
                    {tAdmin("detailsViewProfile")}
                  </Link>
                ) : (
                  "N/A"
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsCreated")}
              </TableCell>
              <TableCell>{joinedDate.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsTwoFactor")}
              </TableCell>
              <TableCell>
                {user.twoFactorEnabled ? tAdmin("detailsStatusTwoFactorYes") : tAdmin("detailsStatusTwoFactorNo")}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsGithub")}
              </TableCell>
              <TableCell>
                {user.hasGithub ? tAdmin("detailsStatusGithubYes") : tAdmin("detailsStatusGithubNo")}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell variant="head" sx={{ fontWeight: "bold" }}>
                {tAdmin("detailsDeletedStatus")}
              </TableCell>
              <TableCell>
                {user.deletedAt ? new Date(user.deletedAt).toLocaleString() : tAdmin("detailsStatusActive")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tAdmin("btnDetailsClose")}</Button>
      </DialogActions>
    </Dialog>
  );
}
