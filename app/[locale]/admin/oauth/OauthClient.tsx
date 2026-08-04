"use client";

import { useState, useTransition } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Switch from "@mui/material/Switch";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import { useTranslations } from "next-intl";
import { tableContainerSx, tableHeadSx, tableRootSx, TABLE_MIN_WIDTH } from "@/components/ui/tableStyles";
import { toggleOAuthClientTrusted, toggleOAuthClientDisabled } from "@/lib/actions/adminOauth";

export interface OAuthClientData {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  homepageUrl: string | null;
  redirectUris: string[];
  scopes: string;
  isConfidential: boolean;
  isTrusted: boolean;
  disabledAt: Date | number | null;
  createdAt: Date | number;
  owner: {
    id: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
}

export default function OauthClient({ clients: initialClients }: { clients: OAuthClientData[] }) {
  const tAdmin = useTranslations("Admin.oauth");
  const [clients, setClients] = useState(initialClients);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggleTrusted = (clientId: string, currentTrusted: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    startTransition(async () => {
      const res = await toggleOAuthClientTrusted(clientId, !currentTrusted);
      if (res.success) {
        setClients(prev =>
          prev.map(c => (c.id === clientId ? { ...c, isTrusted: !currentTrusted } : c))
        );
        setSuccessMsg(tAdmin("success"));
      } else {
        setErrorMsg(res.error || tAdmin("error"));
      }
    });
  };

  const handleToggleDisabled = (clientId: string, currentDisabled: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await toggleOAuthClientDisabled(clientId, !currentDisabled);
      if (res.success) {
        setClients(prev =>
          prev.map(c =>
            c.id === clientId
              ? { ...c, disabledAt: !currentDisabled ? new Date() : null }
              : c
          )
        );
        setSuccessMsg(tAdmin("success"));
      } else {
        setErrorMsg(res.error || tAdmin("error"));
      }
    });
  };

  return (
    <Box>
      {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      
      <TableContainer component={Paper} sx={tableContainerSx}>
        <Table size="small" sx={[tableRootSx, { minWidth: TABLE_MIN_WIDTH }]}>
          <TableHead sx={tableHeadSx}>
            <TableRow>
              <TableCell>{tAdmin("name")}</TableCell>
              <TableCell>{tAdmin("owner")}</TableCell>
              <TableCell>{tAdmin("redirectUris")}</TableCell>
              <TableCell>{tAdmin("scopes")}</TableCell>
              <TableCell align="center">{tAdmin("trusted")}</TableCell>
              <TableCell align="center">{tAdmin("status")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => {
              const isDisabled = !!client.disabledAt;

              return (
                <TableRow key={client.id} hover sx={{ opacity: isDisabled ? 0.5 : 1 }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar src={client.logoUrl || undefined} sx={{ width: 32, height: 32 }}>
                        {client.name.substring(0, 2)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          {client.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          ID: {client.id}
                        </Typography>
                        {client.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                            {client.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar src={client.owner.avatarUrl || undefined} sx={{ width: 24, height: 24 }} />
                      <Box>
                        <Typography variant="body2">
                          {client.owner.displayName || client.owner.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{client.owner.username || "N/A"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {client.redirectUris.map((uri, idx) => (
                        <Typography key={idx} variant="caption" sx={{ wordBreak: "break-all" }}>
                          {uri}
                        </Typography>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {client.scopes.split(" ").map((scope) => (
                        <Chip key={scope} label={scope} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.7rem" }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={client.isTrusted}
                      onChange={() => handleToggleTrusted(client.id, client.isTrusted)}
                      disabled={isPending}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={isDisabled ? tAdmin("statusDisabled") : tAdmin("statusActive")}
                      color={isDisabled ? "error" : "success"}
                      size="small"
                      onClick={() => handleToggleDisabled(client.id, isDisabled)}
                      sx={{ cursor: isPending ? "not-allowed" : "pointer" }}
                      disabled={isPending}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  {tAdmin("noClients")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
