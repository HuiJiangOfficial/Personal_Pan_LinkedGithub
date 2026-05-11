/**
 * POST /api/upload
 * multipart/form-data: file=<File>, path=<可选，相对于 drive 的子路径，如 sub/foo.txt>
 */
import {
  readEnv,
  assertEnv,
  checkPassword,
  jsonResponse,
  corsHeaders,
  githubFetch,
  normalizeRelativePath,
  uint8ToBase64,
  githubErrorBody,
} from '../_utils.js';

const MAX_BYTES = 45 * 1024 * 1024; // GitHub 单文件 100MB 上限；Workers 内存保守限制

export async function onRequestPost(context) {
  const { request, env } = context;
  const cfg = readEnv(env);
  const bad = assertEnv(cfg) || checkPassword(request, cfg);
  if (bad) return attachCors(request, bad);

  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('multipart/form-data')) {
    return attachCors(request, jsonResponse({ error: '请使用 multipart/form-data 上传' }, 400));
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return attachCors(request, jsonResponse({ error: '无法解析表单' }, 400));
  }

  const file = form.get('file');
  const pathField = form.get('path');

  if (!file || typeof file === 'string') {
    return attachCors(request, jsonResponse({ error: '缺少 file 字段' }, 400));
  }

  /** @type {File} */
  const f = file;
  const buf = new Uint8Array(await f.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return attachCors(
      request,
      jsonResponse({ error: `文件过大，请小于 ${Math.floor(MAX_BYTES / 1024 / 1024)} MB` }, 413)
    );
  }

  let relative;
  try {
    const sub = buildRelativeSavePath(pathField, f.name);
    relative = normalizeRelativePath(sub);
  } catch {
    return attachCors(request, jsonResponse({ error: '非法保存路径' }, 400));
  }

  const ghSegments = ['drive', ...relative.split('/').filter(Boolean)].map((s) => encodeURIComponent(s));
  const putUrl = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${ghSegments.join(
    '/'
  )}`;

  // 若已存在文件，需要带 sha 才能更新
  const metaRes = await githubFetch(cfg, `${putUrl}?ref=${encodeURIComponent(cfg.branch)}`);
  let existingSha = null;
  if (metaRes.ok) {
    try {
      const meta = await metaRes.json();
      if (meta && meta.sha) existingSha = meta.sha;
    } catch {
      /* ignore */
    }
  } else if (metaRes.status !== 404) {
    const detail = await githubErrorBody(metaRes);
    return attachCors(
      request,
      jsonResponse({ error: '检查目标文件是否存在时失败', detail, status: metaRes.status }, 502)
    );
  }

  const content = uint8ToBase64(buf);
  const body = {
    message: `web: upload ${relative}`,
    content,
    branch: cfg.branch,
  };
  if (existingSha) body.sha = existingSha;

  const putRes = await githubFetch(cfg, putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const detail = await githubErrorBody(putRes);
    return attachCors(
      request,
      jsonResponse({ error: '上传到 GitHub 失败', detail, status: putRes.status }, 502)
    );
  }

  let json;
  try {
    json = await putRes.json();
  } catch {
    json = null;
  }

  return attachCors(
    request,
    jsonResponse({
      ok: true,
      path: relative,
      content: json?.content || null,
    })
  );
}

/** @param {Request} request @param {Response} res */
function attachCors(request, res) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}

/**
 * @param {FormDataEntryValue | null} pathField
 * @param {string} originalName
 */
function buildRelativeSavePath(pathField, originalName) {
  if (typeof pathField !== 'string' || !pathField.trim()) {
    return originalName;
  }
  const p = pathField.trim().replace(/\\/g, '/');
  if (p.endsWith('/')) {
    return `${p}${originalName}`;
  }
  // 无扩展名且不含点：视为目录前缀
  const base = p.split('/').pop() || '';
  if (base && !base.includes('.')) {
    return `${p.replace(/\/+$/, '')}/${originalName}`;
  }
  return p;
}
