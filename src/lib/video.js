// ── 视频由后端从本机的 media/ 目录提供（GET /api/pieces/{id}/video）────────────
//   视频有版权、体积也大，不进仓库。页面启动时先探测一次：有就自动载入，
//   没有就退回手动填 URL / 选本地文件。
export function videoUrl(pieceId = 'xunmeng') {
  return `/api/pieces/${pieceId}/video`
}

// 有视频返回它的 URL，否则（404、后端连不上）返回 null。用 HEAD，不把文件下载两遍。
export async function probeVideo(pieceId = 'xunmeng', fetchFn = fetch) {
  const url = videoUrl(pieceId)
  try {
    const res = await fetchFn(url, { method: 'HEAD' })
    return res.ok ? url : null
  } catch {
    return null
  }
}
