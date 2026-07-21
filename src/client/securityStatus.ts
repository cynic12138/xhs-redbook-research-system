import type { CredentialSecurityStatus } from "../shared/types.js";

export interface CredentialSecurityPresentation {
  title: string;
  description: string;
  warning: boolean;
  canRetry: boolean;
}

export function credentialSecurityPresentation(
  status: CredentialSecurityStatus | null
): CredentialSecurityPresentation {
  if (!status) {
    return {
      title: "正在检查凭证安全状态…",
      description: "检查完成后会显示 Cookie 和 AI Key 的保护状态。",
      warning: false,
      canRetry: false
    };
  }

  switch (status.state) {
    case "development":
      return {
        title: "开发模式",
        description: "当前为开发模式，凭证仍由 .env.local 管理。",
        warning: false,
        canRetry: false
      };
    case "cleanup-required":
      return {
        title: "需要清理旧凭证",
        description: `仍有 ${status.legacyPlaintextCredentialCount} 项明文凭证需要清理。加密凭证已优先使用，可重新检查并清理。`,
        warning: true,
        canRetry: true
      };
    case "reconfiguration-required":
      return {
        title: "需要重新配置凭证",
        description: `有 ${status.unreadableCredentialCount} 项凭证无法解密。数据库可能来自其他电脑或 Windows 用户，请重新连接小红书或填写模型 Key。`,
        warning: true,
        canRetry: false
      };
    case "empty":
      return {
        title: "尚未配置凭证",
        description: "尚未配置 Cookie 或 AI Key；连接小红书或新增模型后会自动加密保存。",
        warning: false,
        canRetry: false
      };
    case "encrypted":
      return {
        title: "Windows 加密保护已启用",
        description: "Cookie 和 AI Key 已使用 Windows 加密保护。",
        warning: false,
        canRetry: false
      };
  }
}

export function shouldOpenCredentialSettings(status: CredentialSecurityStatus | null): boolean {
  return status?.state === "cleanup-required" || status?.state === "reconfiguration-required";
}
