"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { addProjectMember, removeProjectMember } from "@/lib/actions/member";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface ProjectMembersManagerProps {
  projectId: string;
  members: any[];
  isOwner: boolean;
  currentUserId: string;
}

export default function ProjectMembersManager({ projectId, members, isOwner, currentUserId }: ProjectMembersManagerProps) {
  const [username, setUsername] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const tProject = useTranslations("Project");
  const tCommon = useTranslations("Common");

  const handleAdd = () => {
    if (!username.trim() || isPending) return;

    startTransition(async () => {
      try {
        const res = await addProjectMember(projectId, username.trim());
        if ("error" in res && res.error) {
          alert(res.error);
        } else {
          setUsername("");
          router.refresh();
        }
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const handleRemove = (userId: string) => {
    if (!confirm(tProject("members.deleteConfirm")) || isPending) return;

    startTransition(async () => {
      try {
        await removeProjectMember(projectId, userId);
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
          {tProject("members.title")}
        </Typography>

        <List sx={{ mb: 3 }}>
          {members.map(member => (
            <ListItem key={member.id} divider>
              <ListItemAvatar>
                <Avatar src={member.avatarUrl || undefined} />
              </ListItemAvatar>
              <ListItemText 
                primary={member.displayName || member.username} 
                secondary={`@${member.username}`} 
              />
              <ListItemSecondaryAction>
                {member.role === "owner" ? (
                  <Chip label={tProject("members.owner")} color="primary" size="small" />
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip label={tProject("members.member")} size="small" variant="outlined" />
                    {(isOwner || currentUserId === member.id) && (
                      <IconButton edge="end" color="error" onClick={() => handleRemove(member.id)} disabled={isPending}>
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        {isOwner && (
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <TextField
              size="small"
              label={tProject("members.addUsername")}
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isPending}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleAdd}
              disabled={!username.trim() || isPending}
              sx={{ height: 40 }}
            >
              {tCommon("add")}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
