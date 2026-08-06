/**
 * 管理者向け Server Action の入口。
 * 呼び出し側の import パス（@/lib/actions/admin）を維持するため、実体は責務ごとの
 * ファイルに分けたうえでここから再公開する。
 */
export {
  updateUserRole,
  toggleUserSuspension,
  grantPremium,
  revokePremium,
  updateUsernameByAdmin,
  deleteUser,
  purgeDeletedUsers,
  hardDeleteUser,
} from "./users";

export { adminDeleteProject, adminDeleteIdea } from "./content";

export { getSettingsAudits, getBackupAudits, getDdosAudits } from "./audits";

export { getDdosStateAction, toggleManualUnderAttack } from "./ddos";
