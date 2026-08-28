import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 把根目录下的源文件同步到 public/，让 vite build 把它们拷到 dist/。
// 这样：
//   - 根 plugin.json + preload.cjs 是唯一编辑源
//   - public/plugin.json + public/preload.cjs 是 vite 打包入口（dist/ 源头）
//   - 直接把根 plugin.json 导入 ztools 开发工具（development.main）也能跑
export function syncPublic(rootDir = process.cwd()) {
  copyFileSync(
    resolve(rootDir, 'plugin.json'),
    resolve(rootDir, 'public/plugin.json')
  )
  copyFileSync(
    resolve(rootDir, 'preload.cjs'),
    resolve(rootDir, 'public/preload.cjs')
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncPublic()
}
