/**
 * 用户网盘背景：GET 配置 / GET ?image=1 取图 / POST 上传图与设置 / DELETE 清除
 * 数据仅存于当前会话用户 drive 根下 .webpan/background/（与 list 中隐藏）
 */
import {
  readEnv,
  assertEnv,
  jsonResponse,
  withCors,
  githubFetch,
  githubErrorBody,
  CACHE_PRIVATE_NO_STORE,
  corsHeaders,
} from '../_utils.js';
import { getSession } from '../_session.js';
import { assertDriveRole, assertNotGuestWrite } from '../_authz.js';
import { sessionDriveSub, toGithubUserDrivePath, putBlobAtPath, deleteBlobAtPath } from '../_driveScope.js';
import {
  USER_BG_SETTINGS_REL,
  defaultBackgroundSettings,
  detectBackgroundImage,
  bgBlobRel,
  clampOverlay,
  clampBlur,
  USER_BG_MAX_BYTES,
} from '../_userBackground.js';

function contentsApiPath(cfg, ghPath) {
  return `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')}?ref=${encodeURIComponent(cfg.branch)}`;
}

/** @param {any} cfg @param {string} ghPath */
async function readTextBlob(cfg, ghPath) {
  const res = await githubFetch(cfg, contentsApiPath(cfg, ghPath), {
    headers: { Accept: 'application/vnd.github.raw' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const d = await githubErrorBody(res);
    throw new Error(d || `read ${res.status}`);
  }
  return await res.text();
}

/** @param {any} cfg @param {any} session */
async function readMergedSettings(cfg, session) {
  const base = { ...defaultBackgroundSettings() };
  let text;
  try {
    const gh = toGithubUserDrivePath(session, USER_BG_SETTINGS_REL);
    text = await readTextBlob(cfg, gh);
  } catch {
    return base;
  }
  if (!text) return base;
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object') {
      if (typeof j.overlayOpacity === 'number') base.overlayOpacity = clampOverlay(j.overlayOpacity);
      if (typeof j.blurPx === 'number') base.blurPx = clampBlur(j.blurPx);
      if (j.imageExt != null) base.imageExt = typeof j.imageExt === 'string' ? j.imageExt.toLowerCase() : null;
      if (typeof j.updatedAt === 'string') base.updatedAt = j.updatedAt;
    }
  } catch {
    /* ignore corrupt */
  }
  return base;
}

/** @param {any} cfg @param {any} session @param {{ overlayOpacity: number, blurPx: number, imageExt: string|null, updatedAt: string }} data */
async function writeSettings(cfg, session, data) {
  const body = {
    version: 1,
    overlayOpacity: clampOverlay(data.overlayOpacity),
    blurPx: clampBlur(data.blurPx),
    imageExt: data.imageExt,
    updatedAt: data.updatedAt,
  };
  const json = JSON.stringify(body, null, 2);
  const bytes = new TextEncoder().encode(json);
  const gh = toGithubUserDrivePath(session, USER_BG_SETTINGS_REL);
  await putBlobAtPath(cfg, gh, bytes, 'web: drive background settings');
}

/** @param {any} cfg @param {any} session @param {string} ext */
async function deleteOldBgFiles(cfg, session, exceptExt) {
  const ex = String(exceptExt || '').toLowerCase();
  for (const e of ['png', 'jpg', 'gif']) {
    if (e === ex) continue;
    const rel = bgBlobRel(e);
    if (!rel) continue;
    try {
      const gh = toGithubUserDrivePath(session, rel);
      await deleteBlobAtPath(cfg, gh);
    } catch {
      /* ignore */
    }
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '未配置 JWT_SECRET' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return withCors(request, bad);
  if (!sessionDriveSub(session)) return withCors(request, jsonResponse({ error: '无效会话' }, 401));

  const url = new URL(request.url);
  if (url.searchParams.get('image') === '1') {
    return streamBackgroundImage(request, cfg, session);
  }

  try {
    const settings = await readMergedSettings(cfg, session);
    const ext = settings.imageExt;
    const hasImage = Boolean(ext && bgBlobRel(ext));
    return withCors(
      request,
      jsonResponse(
        {
          ok: true,
          hasImage,
          settings: {
            overlayOpacity: settings.overlayOpacity,
            blurPx: settings.blurPx,
            updatedAt: settings.updatedAt,
          },
        },
        200,
        CACHE_PRIVATE_NO_STORE
      )
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}

/** @param {Request} request @param {any} cfg @param {any} session */
async function streamBackgroundImage(request, cfg, session) {
  let settings;
  try {
    settings = await readMergedSettings(cfg, session);
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
  const ext = settings.imageExt;
  const rel = ext ? bgBlobRel(ext) : null;
  if (!rel) {
    return withCors(request, jsonResponse({ error: '未设置背景图' }, 404, CACHE_PRIVATE_NO_STORE));
  }
  let ghPath;
  try {
    ghPath = toGithubUserDrivePath(session, rel);
  } catch {
    return withCors(request, jsonResponse({ error: '非法路径' }, 400));
  }
  const apiPath = contentsApiPath(cfg, ghPath);
  const ghRes = await githubFetch(cfg, apiPath, {
    headers: { Accept: 'application/vnd.github.raw' },
  });
  if (!ghRes.ok) {
    const t = await ghRes.text();
    return withCors(
      request,
      jsonResponse({ error: '读取背景失败', detail: t.slice(0, 300) }, ghRes.status === 404 ? 404 : 502, CACHE_PRIVATE_NO_STORE)
    );
  }
  const mime =
    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
  const headers = new Headers();
  headers.set('Content-Type', mime);
  headers.set('Cache-Control', 'private, max-age=120');
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  return new Response(ghRes.body, { status: 200, headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '未配置 JWT_SECRET' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return withCors(request, bad);
  bad = await assertNotGuestWrite(session);
  if (bad) return withCors(request, bad);
  if (!sessionDriveSub(session)) return withCors(request, jsonResponse({ error: '无效会话' }, 401));

  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('multipart/form-data')) {
    return withCors(request, jsonResponse({ error: '请使用 multipart/form-data' }, 400));
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return withCors(request, jsonResponse({ error: '无法解析表单' }, 400));
  }

  const file = form.get('file');
  const overlayRaw = form.get('overlayOpacity');
  const blurRaw = form.get('blurPx');

  try {
    const prev = await readMergedSettings(cfg, session);
    let overlay = prev.overlayOpacity;
    let blur = prev.blurPx;
    if (typeof overlayRaw === 'string' && overlayRaw.trim() !== '') {
      overlay = clampOverlay(Number(overlayRaw));
    }
    if (typeof blurRaw === 'string' && blurRaw.trim() !== '') {
      blur = clampBlur(Number(blurRaw));
    }

    let imageExt = prev.imageExt;

    if (file && typeof file !== 'string') {
      /** @type {File} */
      const f = file;
      const buf = new Uint8Array(await f.arrayBuffer());
      if (buf.byteLength > USER_BG_MAX_BYTES) {
        return withCors(request, jsonResponse({ error: `背景图须小于 ${Math.floor(USER_BG_MAX_BYTES / 1024 / 1024)} MB` }, 413));
      }
      const kind = detectBackgroundImage(buf);
      if (!kind) {
        return withCors(request, jsonResponse({ error: '仅支持 JPG、PNG、GIF 图片' }, 400));
      }
      imageExt = kind.ext === 'jpg' ? 'jpg' : kind.ext;
      const rel = bgBlobRel(imageExt);
      if (!rel) return withCors(request, jsonResponse({ error: '无效扩展名' }, 400));
      await deleteOldBgFiles(cfg, session, imageExt === 'jpg' ? 'jpg' : imageExt);
      const gh = toGithubUserDrivePath(session, rel);
      await putBlobAtPath(cfg, gh, buf, 'web: drive background image');
    }

    await writeSettings(cfg, session, {
      overlayOpacity: overlay,
      blurPx: blur,
      imageExt,
      updatedAt: new Date().toISOString(),
    });

    return withCors(
      request,
      jsonResponse(
        {
          ok: true,
          hasImage: Boolean(imageExt),
          settings: { overlayOpacity: overlay, blurPx: blur, updatedAt: new Date().toISOString() },
        },
        200,
        CACHE_PRIVATE_NO_STORE
      )
    );
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  let bad = assertEnv(cfg);
  if (bad) return withCors(request, bad);
  if (!cfg.jwtSecret) return withCors(request, jsonResponse({ error: '未配置 JWT_SECRET' }, 503));

  const session = await getSession(request, env);
  bad = await assertDriveRole(cfg, session);
  if (bad) return withCors(request, bad);
  bad = await assertNotGuestWrite(session);
  if (bad) return withCors(request, bad);
  if (!sessionDriveSub(session)) return withCors(request, jsonResponse({ error: '无效会话' }, 401));

  try {
    for (const e of ['png', 'jpg', 'gif']) {
      const rel = bgBlobRel(e);
      if (!rel) continue;
      try {
        await deleteBlobAtPath(cfg, toGithubUserDrivePath(session, rel));
      } catch {
        /* ignore */
      }
    }
    try {
      await deleteBlobAtPath(cfg, toGithubUserDrivePath(session, USER_BG_SETTINGS_REL));
    } catch {
      /* ignore */
    }
    await writeSettings(cfg, session, {
      ...defaultBackgroundSettings(),
      imageExt: null,
      updatedAt: new Date().toISOString(),
    });

    return withCors(request, jsonResponse({ ok: true }, 200, CACHE_PRIVATE_NO_STORE));
  } catch (e) {
    return withCors(request, jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500));
  }
}
