import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function toPackagedManifest(manifest) {
  const { development: _development, ...packagedManifest } = manifest
  return packagedManifest
}

export function preparePackage(rootDir = process.cwd()) {
  const distDir = resolve(rootDir, 'dist')
  // 从根 plugin.json 读取并去掉 development 字段，写到 dist/plugin.json
  // （覆盖 vite 从 public/plugin.json 拷过来的那份，避免再有过时拷贝）
  const manifest = JSON.parse(readFileSync(resolve(rootDir, 'plugin.json'), 'utf8'))
  const packagedManifest = toPackagedManifest(manifest)

  writeFileSync(
    resolve(distDir, 'plugin.json'),
    `${JSON.stringify(packagedManifest, null, 2)}\n`,
    'utf8'
  )
  // preload.cjs 在 sync-public 阶段已经拷到 public/preload.cjs，vite build 会拷到 dist/preload.cjs，无需再处理
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  preparePackage()
}
