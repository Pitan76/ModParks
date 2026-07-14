"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { generateApiKey, deleteApiKey } from "@/lib/actions/settings";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface ApiKeysTabProps {
  apiKeys: { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }[];
}

export default function ApiKeysTab({ apiKeys }: ApiKeysTabProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Settings");
  const format = useFormatter();

  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [apiKeyMsg, setApiKeyMsg] = useState("");

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    const res = await generateApiKey(newKeyName);
    if (res.success && res.key) {
      setGeneratedKey(res.key);
      setNewKeyName("");
      setApiKeyMsg(t("apiKeys.successGenerate"));
    }
  };

  const handleDeleteKey = async (id: string) => {
    await deleteApiKey(id);
    setApiKeyMsg(t("apiKeys.successDelete"));
    setGeneratedKey("");
    setTimeout(() => setApiKeyMsg(""), 3000);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t("apiKeys.description")}</Typography>

      {apiKeyMsg && <Alert severity="success" sx={{ mb: 3 }}>{apiKeyMsg}</Alert>}

      {generatedKey && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontFamily: "monospace", fontWeight: "bold" }}>{generatedKey}</Typography>
            <IconButton size="small" onClick={() => navigator.clipboard.writeText(generatedKey)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
        </Alert>
      )}

      <Box component="form" onSubmit={handleGenerateKey} sx={{ display: "flex", gap: 2, mb: 4 }}>
        <TextField label={t("apiKeys.name")} size="small" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} required />
        <Button type="submit" variant="contained" sx={{ height: 40 }}>{t("apiKeys.generate")}</Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t("apiKeys.name")}</TableCell>
              <TableCell>{t("apiKeys.lastUsed")}</TableCell>
              <TableCell align="right">{tCommon("delete")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiKeys.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.name}</TableCell>
                <TableCell>{k.lastUsedAt ? format.dateTime(new Date(k.lastUsedAt), { dateStyle: "short" }) : t("apiKeys.neverUsed")}</TableCell>
                <TableCell align="right">
                  <IconButton color="error" onClick={() => handleDeleteKey(k.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {apiKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>{t("apiKeys.noKeys")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
