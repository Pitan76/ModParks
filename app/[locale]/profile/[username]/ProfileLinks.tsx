import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TwitterIcon from "@mui/icons-material/Twitter";
import InstagramIcon from "@mui/icons-material/Instagram";
import { parseLinks } from "@/lib/utils/links";
import type { ProfileUser } from "./profileData";

function getLinkIcon(url: string) {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("x.com")) return <XIcon fontSize="small" />;
    if (hostname.includes("twitter.com")) return <TwitterIcon fontSize="small" />;
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return <YouTubeIcon fontSize="small" />;
    if (hostname.includes("instagram.com")) return <InstagramIcon fontSize="small" />;
    if (hostname.includes("github.com")) return <GitHubIcon fontSize="small" />;
    if (hostname.includes("curseforge.com"))
      return <Box component="img" src="https://www.curseforge.com/favicon.ico" sx={{ width: 16, height: 16, mr: 0.5 }} />;
    if (hostname.includes("modrinth.com"))
      return <Box component="img" src="https://modrinth.com/favicon.ico" sx={{ width: 16, height: 16, mr: 0.5 }} />;
  } catch {
    // 不正なURLは既定アイコンにフォールバック
  }
  return <LinkIcon fontSize="small" />;
}

export default function ProfileLinks({ user }: { user: ProfileUser }) {
  const parsedLinks = parseLinks(user.links);
  const showGithub = user.githubUsername && ((user.custom as Record<string, any>)?.showGithubLink ?? true);

  if (parsedLinks.length === 0 && !showGithub) return null;

  return (
    <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", justifyContent: { xs: "center", sm: "flex-start" }, gap: 2 }}>
      {showGithub && (
        <Link
          href={`https://github.com/${user.githubUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
        >
          <GitHubIcon fontSize="small" />
          {user.githubUsername}
        </Link>
      )}
      {parsedLinks.map((link: any, i: number) => (
        <Link
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.primary" }}
        >
          {getLinkIcon(link.url)}
          {link.title || link.url}
        </Link>
      ))}
    </Box>
  );
}
