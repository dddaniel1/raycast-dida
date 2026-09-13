import { ApiError } from "../lib/errors";
import { getBaseUrl, getPreferences } from "../lib/preferences";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

// 429 is handled defensively below; rate limits are not documented in the official Open API spec.
const STATUS_MESSAGES: Record<number, string> = {
  400: "请求无效（400）：请检查提交的内容",
  401: "认证失败（401）：API Token 无效或已过期，请重新获取",
  403: "没有权限（403）：当前 Token 无权访问该资源",
  404: "资源不存在（404）",
  429: "请求过于频繁（429）：请稍后重试（该限流码未在官方文档中定义，属防御性处理）",
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token } = getPreferences();
  if (!token) {
    throw new ApiError(
      0,
      "缺少 API Token：请在扩展设置中填写滴答清单 Open API Token",
    );
  }

  let res: Response;
  try {
    res = await fetch(getBaseUrl() + path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "网络错误：无法连接滴答清单 API，请检查网络连接");
  }

  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
  const detail =
    res.status >= 500
      ? "服务器错误（" + res.status + "）：滴答清单服务暂时不可用，请稍后重试"
      : (STATUS_MESSAGES[res.status] ?? "请求失败（" + res.status + "）");
  throw new ApiError(
    res.status,
    retryAfter ? detail + "，" + retryAfter + " 秒后重试" : detail,
    retryAfter,
  );
}

/** Token validity check: a successful GET /project proves the token works. */
export async function validateToken(): Promise<boolean> {
  await request<unknown>("/project");
  return true;
}
