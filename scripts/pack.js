/**
 * 打包脚本：将 electron-vite 构建产物 + Windows Electron 运行时组装成可运行目录
 * 用于 WSL2 下无法使用 electron-builder（需要 wine）的场景
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { createReadStream } = require('fs')
const { pipeline } = require('stream/promises')
const { createUnzip } = require('zlib')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist', 'voice-pipe')
const ELECTRON_VERSION = '35.7.5'
const ELECTRON_WIN_ZIP = path.join(require('os').homedir(), '.cache', 'electron', `electron-v${ELECTRON_VERSION}-win32-x64.zip`)

/** 执行命令并打印 */
function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

/** 下载 Windows Electron（如果缓存中没有） */
async function ensureElectronWin() {
  if (fs.existsSync(ELECTRON_WIN_ZIP)) {
    console.log(`使用缓存: ${ELECTRON_WIN_ZIP}`)
    return ELECTRON_WIN_ZIP
  }

  const url = `https://npmmirror.com/mirrors/electron/${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-win32-x64.zip`
  console.log(`下载 Windows Electron: ${url}`)

  const cacheDir = path.dirname(ELECTRON_WIN_ZIP)
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  // 使用 curl 下载
  execSync(`curl -L -o "${ELECTRON_WIN_ZIP}" "${url}"`, { stdio: 'inherit' })
  return ELECTRON_WIN_ZIP
}

/** 解压 zip（使用系统 unzip） */
function extractZip(zipPath, destDir) {
  console.log(`解压: ${zipPath} -> ${destDir}`)
  execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' })
}

async function main() {
  // 1. 清理 dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true })
  }
  fs.mkdirSync(DIST, { recursive: true })

  // 3. 下载并解压 Windows Electron 运行时
  const zipPath = await ensureElectronWin()
  extractZip(zipPath, DIST)

  // 4. 复制 app 代码到 resources
  const resourcesDir = path.join(DIST, 'resources')
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true })
  }

  const appDir = path.join(resourcesDir, 'app')
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true })
  }
  fs.mkdirSync(appDir, { recursive: true })

  // 复制 out, package.json
  fs.cpSync(path.join(ROOT, 'out'), path.join(appDir, 'out'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(appDir, 'package.json'))

  // 复制 locales
  if (fs.existsSync(path.join(ROOT, 'locales'))) {
    fs.cpSync(path.join(ROOT, 'locales'), path.join(appDir, 'locales'), { recursive: true })
  }

  // 复制 resources（图标等）
  if (fs.existsSync(path.join(ROOT, 'resources'))) {
    const resFiles = fs.readdirSync(path.join(ROOT, 'resources'))
    if (resFiles.length > 0) {
      const destRes = path.join(resourcesDir, 'resources')
      if (!fs.existsSync(destRes)) fs.mkdirSync(destRes, { recursive: true })
      fs.cpSync(path.join(ROOT, 'resources'), destRes, { recursive: true })
    }
  }

  // 5. 复制 node_modules 运行时依赖（递归收集所有子依赖）
  const nodeModulesDir = path.join(appDir, 'node_modules')
  if (!fs.existsSync(nodeModulesDir)) {
    fs.mkdirSync(nodeModulesDir, { recursive: true })
  }

  /** 从 pnpm store 复制一个包（解析符号链接到真实路径） */
  function copyPackage(name) {
    // 先检查顶层 node_modules，再检查 .pnpm store
    let srcLink = path.join(ROOT, 'node_modules', name)
    if (!fs.existsSync(srcLink)) {
      // 在 .pnpm 中搜索
      const pnpmDir = path.join(ROOT, 'node_modules', '.pnpm')
      const matches = fs.readdirSync(pnpmDir).filter(d => {
        const pkgName = d.split('@').slice(0, -1).join('@') || d.split('@')[0]
        return pkgName === name
      })
      if (matches.length > 0) {
        srcLink = path.join(pnpmDir, matches[0], 'node_modules', name)
      }
    }
    if (!fs.existsSync(srcLink)) {
      console.log(`  跳过 ${name}（不存在）`)
      return
    }
    const src = fs.realpathSync(srcLink)
    const dest = path.join(nodeModulesDir, name)
    if (fs.existsSync(dest)) return
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    console.log(`  复制 ${name}`)
    fs.cpSync(src, dest, { recursive: true, force: true })

    // 递归处理该包的依赖
    const pkgJson = path.join(dest, 'package.json')
    if (fs.existsSync(pkgJson)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.optionalDependencies }
      for (const dep of Object.keys(deps)) {
        copyPackage(dep)
      }
    }
  }

  // 从顶层依赖开始递归复制
  copyPackage('uiohook-napi')
  copyPackage('ws')
  const wsDest = path.join(nodeModulesDir, 'ws')
  console.log(`\n✅ 打包完成: ${DIST}`)
  console.log(`   在 Windows 上运行: ${path.join(DIST, 'VoicePipe.exe')}`)
}

main().catch(err => {
  console.error('打包失败:', err)
  process.exit(1)
})
