import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error JavaScript packaging helper
import { toPackagedManifest } from '../scripts/prepare-package.mjs'
// @ts-expect-error JavaScript packaging helper
import { syncPublic } from '../scripts/sync-public.mjs'

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

describe('plugin packaging metadata', () => {
  it('uses the published Jenkins Lite id throughout the project', () => {
    const packageJson = readJson('package.json')
    const pluginJson = readJson('plugin.json')
    const devPluginJson = readJson('public/plugin.json')

    expect(packageJson.name).toBe('jenkins-lite')
    expect(pluginJson.name).toBe('jenkins-lite')
    expect(devPluginJson.name).toBe('jenkins-lite')
  })

  it('points development mode at the configured Vite port', () => {
    const pluginJson = readJson('plugin.json')
    const devPluginJson = readJson('public/plugin.json')

    expect(pluginJson.development.main).toBe('http://localhost:5180')
    expect(devPluginJson.development.main).toBe('http://localhost:5180')
  })

  it('exposes the full feature set so shortcuts like 构建 / jenkins收藏 register', () => {
    const pluginJson = readJson('plugin.json')
    const codes = pluginJson.features.map((f) => f.code)
    expect(codes).toEqual(expect.arrayContaining(['jenkins', 'jenkins-build', 'jenkins-favorite']))
  })

  it('references preload.cjs (CommonJS) in both manifests', () => {
    const pluginJson = readJson('plugin.json')
    const devPluginJson = readJson('public/plugin.json')

    expect(pluginJson.preload).toBe('preload.cjs')
    expect(devPluginJson.preload).toBe('preload.cjs')
  })

  it('keeps the root manifest and public/ mirror identical', () => {
    const pluginJson = readJson('plugin.json')
    const devPluginJson = readJson('public/plugin.json')

    expect(devPluginJson).toEqual(pluginJson)
  })

  it('ships preload.cjs at both root (for direct dev import) and public/ (for vite build)', () => {
    expect(existsSync(resolve('preload.cjs'))).toBe(true)
    expect(existsSync(resolve('public/preload.cjs'))).toBe(true)
  })

  it('syncPublic keeps root and public/ manifests byte-equal', () => {
    // 故意在 public/ 写一份会过时内容，跑 sync 后必须回到与根一致
    writeFileSync(resolve('public/plugin.json'), '{}', 'utf8')
    syncPublic()

    const pluginJson = readJson('plugin.json')
    const devPluginJson = readJson('public/plugin.json')
    expect(devPluginJson).toEqual(pluginJson)
  })

  it('removes development-only metadata from the packaged manifest', () => {
    const pluginJson = readJson('plugin.json')
    const packagedManifest = toPackagedManifest(pluginJson)

    expect(packagedManifest.name).toBe('jenkins-lite')
    expect(packagedManifest.main).toBe('index.html')
    expect(packagedManifest.preload).toBe('preload.cjs')
    expect(packagedManifest).not.toHaveProperty('development')
  })

  it('marks the packaged plugin root as CommonJS for preload.cjs', () => {
    expect(existsSync(resolve('public/package.json'))).toBe(true)
    expect(readJson('public/package.json').type).toBe('commonjs')
  })
})
