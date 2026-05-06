const APP_ASSET_VERSION = "20260429-acc-custom-integration";
const LANGUAGE_STORAGE_KEY = "cde.language";
const SESSION_CHECK_TIMEOUT_MS = 4500;
const WORKSPACE_SESSION_CHECK_TIMEOUT_MS = 12000;
const LOGIN_REQUEST_TIMEOUT_MS = 15000;
const BUSINESS_ASSET_PREFETCH_DELAY_MS = 1200;

const TEXT = {
  checking: ["正在检查登录状态...", "Checking session..."],
  readyPassword: ["请输入账号和密码登录。", "Sign in with your email and password."],
  readyLark: ["点击下方按钮跳转飞书授权，完成后将自动回到系统。", "Use the button below to jump to Lark and come back automatically."],
  connecting: ["正在连接系统", "Connecting..."],
  signIn: ["登录系统", "Sign In"],
  larkLogin: ["飞书登录", "Lark Login"],
  verifying: ["正在验证账号...", "Verifying account..."],
  signingIn: ["登录中...", "Signing in..."],
  login: ["登录", "Sign In"],
  missingCredentials: ["请输入邮箱和密码。", "Enter your email and password."],
  loginFailed: ["登录失败，请稍后重试。", "Sign in failed. Please try again later."],
  loginTimeout: ["登录请求超时，请检查网络后重试。", "The sign-in request timed out. Check your network and try again."],
  sessionFailed: ["登录服务暂不可用，请稍后重试。", "The sign-in service is temporarily unavailable. Please try again later."],
  loadingWorkspace: ["正在进入工作台...", "Opening workspace..."],
  larkRedirecting: ["正在跳转飞书授权...", "Redirecting to Lark..."],
  continueLark: ["前往飞书授权", "Continue with Lark"],
  redirecting: ["跳转中...", "Redirecting..."],
};

let activeTab = "password";
let busy = true;
let checkingSession = true;
let mainAppLoading = false;
let sessionCheckController = null;
let businessAssetPrefetchTimer = 0;
let businessAssetPrefetched = false;

const elements = {
  authShell: document.querySelector("#authShell"),
  shell: document.querySelector(".shell"),
  form: document.querySelector("#loginForm"),
  title: document.querySelector("#authCardTitle"),
  status: document.querySelector("#authStatusText"),
  error: document.querySelector("#loginErrorText"),
  email: document.querySelector("#loginEmailInput"),
  password: document.querySelector("#loginPasswordInput"),
  submit: document.querySelector("#loginSubmitButton"),
  passwordTab: document.querySelector("#passwordLoginTab"),
  larkTab: document.querySelector("#larkLoginTab"),
  passwordPanel: document.querySelector("#loginPasswordPanel"),
  larkPanel: document.querySelector("#loginLarkPanel"),
  larkButton: document.querySelector("#larkLoginButton"),
};

function language() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function t(key) {
  const pair = TEXT[key] || [key, key];
  return language() === "en" ? pair[1] : pair[0];
}

function setError(message = "") {
  if (!elements.error) {
    return;
  }
  elements.error.textContent = message;
  elements.error.classList.toggle("hidden", !message);
}

function renderAuthShell(message = "") {
  if (elements.authShell) {
    elements.authShell.classList.remove("hidden");
  }
  if (elements.shell) {
    elements.shell.classList.add("hidden");
  }
  elements.passwordTab?.classList.toggle("active", activeTab !== "lark");
  elements.larkTab?.classList.toggle("active", activeTab === "lark");
  elements.passwordPanel?.classList.toggle("hidden", activeTab === "lark");
  elements.larkPanel?.classList.toggle("hidden", activeTab !== "lark");
  if (elements.title) {
    elements.title.textContent = (busy || checkingSession) && !mainAppLoading
      ? t("connecting")
      : activeTab === "lark"
        ? t("larkLogin")
        : t("signIn");
  }
  if (elements.status) {
    elements.status.textContent = message || (checkingSession ? t("checking") : activeTab === "lark" ? t("readyLark") : t("readyPassword"));
  }
  if (elements.email) {
    elements.email.disabled = busy || activeTab === "lark";
  }
  if (elements.password) {
    elements.password.disabled = busy || activeTab === "lark";
  }
  if (elements.submit) {
    elements.submit.disabled = busy || activeTab === "lark";
    elements.submit.textContent = busy && activeTab !== "lark" ? t("signingIn") : t("login");
  }
  if (elements.passwordTab) {
    elements.passwordTab.disabled = busy;
  }
  if (elements.larkTab) {
    elements.larkTab.disabled = busy;
  }
  if (elements.larkButton) {
    elements.larkButton.disabled = busy || activeTab !== "lark";
    elements.larkButton.textContent = busy && activeTab === "lark" ? t("redirecting") : t("continueLark");
  }
}

function ensureBusinessStyles() {
  if (document.querySelector('link[data-cde-business-styles="true"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./styles.css?v=${APP_ASSET_VERSION}`;
  link.dataset.cdeBusinessStyles = "true";
  document.head.append(link);
}

function prefetchBusinessAsset(href, as) {
  if (document.querySelector(`link[data-cde-business-prefetch="${as}"]`)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = as;
  link.href = href;
  link.dataset.cdeBusinessPrefetch = as;
  document.head.append(link);
}

function prefetchBusinessAssets() {
  if (businessAssetPrefetched || mainAppLoading) {
    return;
  }
  businessAssetPrefetched = true;
  prefetchBusinessAsset(`./styles.css?v=${APP_ASSET_VERSION}`, "style");
  prefetchBusinessAsset(`./app.js?v=${APP_ASSET_VERSION}`, "script");
}

function scheduleBusinessAssetPrefetch() {
  if (businessAssetPrefetched || businessAssetPrefetchTimer || mainAppLoading) {
    return;
  }
  businessAssetPrefetchTimer = window.setTimeout(() => {
    businessAssetPrefetchTimer = 0;
    if (mainAppLoading) {
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(prefetchBusinessAssets, { timeout: 2500 });
      return;
    }
    prefetchBusinessAssets();
  }, BUSINESS_ASSET_PREFETCH_DELAY_MS);
}

async function loadMainApp(sessionPayload = null) {
  if (mainAppLoading) {
    return;
  }
  mainAppLoading = true;
  if (businessAssetPrefetchTimer) {
    window.clearTimeout(businessAssetPrefetchTimer);
    businessAssetPrefetchTimer = 0;
  }
  busy = true;
  setError("");
  renderAuthShell(t("loadingWorkspace"));
  if (!elements.shell) {
    window.location.replace("/");
    return;
  }
  if (sessionPayload) {
    window.__CDE_AUTH_BOOTSTRAP_SESSION = sessionPayload;
  }
  ensureBusinessStyles();
  await import(`./app.js?v=${APP_ASSET_VERSION}`);
}

async function fetchSession(signal = null) {
  const response = await fetch("/api/session", {
    credentials: "same-origin",
    signal,
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || t("sessionFailed"));
  }
  return payload;
}

function startSessionCheck(timeoutMs = SESSION_CHECK_TIMEOUT_MS) {
  sessionCheckController = typeof AbortController !== "undefined" ? new AbortController() : null;
  const controller = sessionCheckController;
  const timeoutId = controller
    ? window.setTimeout(() => {
      controller.abort();
    }, timeoutMs)
    : 0;
  return fetchSession(controller?.signal || null).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    if (sessionCheckController === controller) {
      sessionCheckController = null;
    }
  });
}

function guardAuthBootstrapSession(sessionPromise) {
  return sessionPromise.catch((error) => ({
    __cdeAuthBootstrapError: error?.name === "AbortError"
      ? t("sessionFailed")
      : error?.message || t("sessionFailed"),
  }));
}

async function submitPasswordLogin() {
  sessionCheckController?.abort();
  sessionCheckController = null;
  checkingSession = false;
  const email = elements.email?.value.trim() || "";
  const password = elements.password?.value || "";
  if (!email || !password) {
    setError(t("missingCredentials"));
    return;
  }
  busy = true;
  setError("");
  renderAuthShell(t("verifying"));
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => {
      controller.abort();
    }, LOGIN_REQUEST_TIMEOUT_MS)
    : 0;
  try {
    const response = await fetch("/api/session/login", {
      method: "POST",
      credentials: "same-origin",
      signal: controller?.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.authenticated) {
      throw new Error(payload.error || t("loginFailed"));
    }
    if (elements.password) {
      elements.password.value = "";
    }
    await loadMainApp(payload);
  } catch (error) {
    busy = false;
    setError(error?.name === "AbortError" ? t("loginTimeout") : error?.message || t("loginFailed"));
    renderAuthShell(activeTab === "lark" ? t("readyLark") : t("readyPassword"));
    scheduleBusinessAssetPrefetch();
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

function startLarkLogin() {
  sessionCheckController?.abort();
  sessionCheckController = null;
  checkingSession = false;
  busy = true;
  setError("");
  renderAuthShell(t("larkRedirecting"));
  const targetUrl = new URL("/api/session/lark/authorize", window.location.origin);
  targetUrl.searchParams.set("mode", "login");
  window.location.assign(targetUrl.toString());
}

function bindAuthEvents() {
  elements.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (activeTab === "lark") {
      startLarkLogin();
      return;
    }
    void submitPasswordLogin();
  });
  elements.passwordTab?.addEventListener("click", () => {
    if (busy) return;
    activeTab = "password";
    setError("");
    renderAuthShell(t("readyPassword"));
  });
  elements.larkTab?.addEventListener("click", () => {
    if (busy) return;
    activeTab = "lark";
    setError("");
    renderAuthShell(t("readyLark"));
  });
  elements.larkButton?.addEventListener("click", () => {
    if (!busy) {
      startLarkLogin();
    }
  });
  [elements.email, elements.password, elements.submit, elements.larkTab].forEach((element) => {
    element?.addEventListener("focus", scheduleBusinessAssetPrefetch, { passive: true });
    element?.addEventListener("pointerenter", scheduleBusinessAssetPrefetch, { passive: true });
  });
}

function consumeStartupAuthParams() {
  const url = new URL(window.location.href);
  const hasAuthPayload =
    url.searchParams.has("lark_mode") ||
    url.searchParams.has("lark_status") ||
    url.searchParams.has("lark_message") ||
    url.searchParams.has("auth_tab");
  const result = {
    authTab: url.searchParams.get("auth_tab") || "",
    status: url.searchParams.get("lark_status") || "",
    message: url.searchParams.get("lark_message") || "",
  };
  if (!hasAuthPayload) {
    return result;
  }
  if (result.authTab === "lark") {
    activeTab = "lark";
  }
  ["lark_mode", "lark_status", "lark_message", "auth_tab"].forEach((key) => {
    url.searchParams.delete(key);
  });
  const search = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
  return result;
}

async function bootstrapAuth() {
  const startupAuth = consumeStartupAuthParams();
  bindAuthEvents();
  busy = false;
  checkingSession = true;
  if (startupAuth.status === "error") {
    setError(startupAuth.message || t("loginFailed"));
  }
  renderAuthShell(t("checking"));
  const sessionPromise = startSessionCheck(elements.shell ? WORKSPACE_SESSION_CHECK_TIMEOUT_MS : SESSION_CHECK_TIMEOUT_MS);
  try {
    const session = await sessionPromise;
    if (session.authenticated && session.access) {
      checkingSession = false;
      await loadMainApp(session);
      return;
    }
    checkingSession = false;
    renderAuthShell(activeTab === "lark" ? t("readyLark") : t("readyPassword"));
    scheduleBusinessAssetPrefetch();
  } catch (error) {
    if (error?.name !== "AbortError") {
      setError(error?.message || t("sessionFailed"));
    }
    checkingSession = false;
    if (!busy && !mainAppLoading) {
      renderAuthShell(activeTab === "lark" ? t("readyLark") : t("readyPassword"));
      scheduleBusinessAssetPrefetch();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootstrapAuth();
  }, { once: true });
} else {
  void bootstrapAuth();
}
