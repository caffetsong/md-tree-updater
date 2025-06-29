#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import dirTree from 'directory-tree'
import yaml from 'js-yaml'

// 将标记定义为全局常量，以便多个函数共享
const TREE_START_TAG = '<!-- TREE_START -->'
const TREE_END_TAG = '<!-- TREE_END -->'

/**
 * 首次运行时，智能地创建或更新所有必要的配置文件。
 */
async function initializeConfiguration() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))

  // --- 1. 定义所有文件路径和默认内容 ---
  const filesToSetup = {
    config: {
      path: path.join(scriptDir, 'tree-config.mjs'),
      content: `export const config = {
  root: '.',//你的根目录,一般不修改
  targetFile: 'README.md',//将添加目录树的Markdown文件
  descriptionsFile: 'tree-descriptions.yml',//在此为目录树中的文件和文件夹添加描述
  ignoreFile: '.treeignore',//忽略规则文件
};`
    },
    ignore: {
      path: './.treeignore',
      content: `# Ignore rules file for md-tree-updater
# md-tree-updater的忽略规则文件

# Rules ending with a "/" are for shallow ignoring.
# 以 "/" 结尾为不完全忽略

# --- Shallow Ignore (Folders Only) ---
# --- 不完全忽略 ---

# appear in the tree, but their contents will not be expanded.
# 文件夹显示在树中，但其内部内容不会被展开。
node_modules/
dist/
build/
.vscode/

# --- Complete Ignore (Files & Folders) ---
# --- 完全忽略 ---

# will be completely hidden from the tree.
# 文件和文件夹将完全从树中隐藏。
.git
.idea
.DS_Store
`
    },
    descriptions: {
      path: './tree-descriptions.yml',
      content: `# 在此文件中为您项目的文件和文件夹添加描述
# 格式为: '路径/': '你的描述'
#
# 示例:
# './': '我的项目根目录 My project root directory'
`
    }
  }

  // --- 2. 智能创建常规配置文件 (不存在则创建，存在则跳过) ---
  for (const key in filesToSetup) {
    const { path, content } = filesToSetup[key]
    try {
      // 使用 'wx' 标志，如果文件已存在，则此操作会失败，正好符合我们的需求
      await fs.writeFile(path, content, { flag: 'wx' })
      console.log(`[TREE-GEN] Created: ${path}`)
      console.log(`[TREE-GEN] 已创建: ${path}`)
    } catch (e) {
      if (e.code !== 'EEXIST') throw e // 如果是“文件已存在”之外的错误，则抛出
    }
  }

  // --- 3. 智能处理目标Markdown文件 ---
  const tempTargetFile = 'README.md' // 与configContent中的默认值保持一致
  const mdTags = `\n\n${TREE_START_TAG}\n<!-- Your directory tree will appear here -->\n${TREE_END_TAG}\n`
  try {
    const mdContent = await fs.readFile(tempTargetFile, 'utf-8')
    // 如果文件已存在但缺少标记，则追加标记
    if (!mdContent.includes(TREE_START_TAG)) {
      console.log(`[TREE-GEN] Appending tags to existing file: ${tempTargetFile}`)
      console.log(`[TREE-GEN] 正在为已存在的文件追加标记: ${tempTargetFile}`)
      await fs.appendFile(tempTargetFile, mdTags)
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      // 如果文件不存在，则创建它并带上标记
      console.log(`[TREE-GEN] Created: ${tempTargetFile}`)
      console.log(`[TREE-GEN] 已创建: ${tempTargetFile}`)
      await fs.writeFile(tempTargetFile, `# My Project Documentation\n${mdTags}`)
    } else {
      throw e // 如果是其他读取错误，则抛出
    }
  }
}

/**
 * 加载并解析 .treeignore 文件。
 * @param {string} ignoreFilePath - .treeignore 文件的路径。
 * @returns {Promise<{deep: RegExp[], shallow: RegExp[]}>}
 */
async function loadIgnoreConfig(ignoreFilePath) {
  const ignoreConfig = { deep: [], shallow: [] }
  try {
    const fileContent = await fs.readFile(ignoreFilePath, 'utf-8')
    const lines = fileContent.split(/\r?\n/)

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const pattern = trimmedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '')
        const regex = new RegExp(`^${pattern}(\/|$)`)
        if (trimmedLine.endsWith('/')) {
          ignoreConfig.shallow.push(regex)
        } else {
          ignoreConfig.deep.push(regex)
        }
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`[TREE-GEN] Warning: Could not read ignore file at: ${ignoreFilePath}.`)
    }
  }
  return ignoreConfig
}

/**
 * 递归地构建带有描述的目录树字符串。
 * @param {object} treeNode - directory-tree 生成的节点对象。
 * @param {object} descriptions - 从 YAML 文件加载的描述对象。
 * @param {object} ignoreConfig - 忽略配置。
 * @param {string} prefix - 用于表示层级的缩进前缀。
 * @returns {string} 格式化后的树字符串的一部分。
 */
function buildTreeString(treeNode, descriptions, ignoreConfig, prefix = '') {
  let output = ''
  const children = treeNode.children || []
  children.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })

  children.forEach((child, index) => {
    const isLast = index === children.length - 1
    const connector = isLast ? '└─ ' : '├─ '
    const relativePath = path.relative(process.cwd(), child.path).replace(/\\/g, '/')
    const isDirectory = child.type === 'directory'
    const displayName = isDirectory ? `${child.name}/` : child.name
    const lookupPath = isDirectory ? `${relativePath}/` : relativePath
    const description = descriptions[lookupPath] || ''
    const descriptionText = description ? ` # (${description})` : ''
    output += `${prefix}${connector}${displayName}${descriptionText}\n`
    const nextPrefix = prefix + (isLast ? '   ' : '│  ')
    const isShallowIgnored = ignoreConfig.shallow.some((regex) => regex.test(relativePath))
    if (child.children && !isShallowIgnored) {
      output += buildTreeString(child, descriptions, ignoreConfig, nextPrefix)
    }
  })
  return output
}

/**
 * 同步 descriptions.yml 文件。
 * @param {object} descriptions - 当前的描述对象。
 * @param {Array<string>} livePaths - 文件系统中实际存在的路径数组。
 * @param {string} descriptionsFilePath - 描述文件的路径。
 */
async function syncDescriptionsFile(descriptions, livePaths, descriptionsFilePath) {
  const livePathsSet = new Set(livePaths)
  const describedPathsSet = new Set(Object.keys(descriptions))
  let fileChanged = false

  const newPaths = livePaths.filter((p) => !describedPathsSet.has(p))
  if (newPaths.length > 0) {
    newPaths.forEach((p) => {
      descriptions[p] = ''
    })
    fileChanged = true
    console.log(
      `[TREE-GEN] Found and added ${newPaths.length} new paths to ${descriptionsFilePath}.`
    )
    console.log(`[TREE-GEN] 发现 ${newPaths.length} 个新路径，已添加至 ${descriptionsFilePath}。`)
  }

  const deletedPaths = [...describedPathsSet].filter((p) => !livePathsSet.has(p))
  let archivedContent = ''
  if (deletedPaths.length > 0) {
    deletedPaths.forEach((p) => {
      archivedContent += `# "${p}": "${descriptions[p]}" # (File deleted)\n`
      delete descriptions[p]
    })
    fileChanged = true
    console.log(
      `[TREE-GEN] Found and archived ${deletedPaths.length} deleted paths in ${descriptionsFilePath}.`
    )
    console.log(
      `[TREE-GEN] 发现 ${deletedPaths.length} 个已删除路径，已在 ${descriptionsFilePath} 中归档。`
    )
  }

  if (fileChanged) {
    const header = `# 项目结构描述源文件\n# 请在此处为文件或目录添加描述，格式为 "路径/": "描述"。\n\n`
    const mainContent = yaml.dump(descriptions, { indent: 2, sortKeys: true })
    const finalContent =
      header +
      mainContent +
      (archivedContent ? `\n# --- Archived Entries ---\n${archivedContent}` : '')
    await fs.writeFile(descriptionsFilePath, finalContent, 'utf-8')
  }
}

/**
 * 主构建函数，包含了完整的初始化和健壮的错误处理逻辑。
 */
async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const configFilePath = path.join(scriptDir, 'tree-config.mjs')

  try {
    // 检查配置文件是否存在，以区分首次运行和正常运行
    await fs.access(configFilePath)

    // --- 正常运行逻辑 ---
    const absoluteConfigPath = path.resolve(configFilePath)
    const configFileURL = pathToFileURL(absoluteConfigPath)
    const { config } = await import(configFileURL)
    const { root, targetFile, descriptionsFile, ignoreFile } = config

    // 在执行前，先检查目标文件和标记
    let mdContent
    try {
      mdContent = await fs.readFile(targetFile, 'utf-8')
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new Error(
          `Target file "${targetFile}" does not exist. Please create it or check your 'tree-config.mjs'.`
        )
      }
      throw e
    }

    if (!mdContent.includes(TREE_START_TAG) || !mdContent.includes(TREE_END_TAG)) {
      console.log(`[TREE-GEN] Tags not found in ${targetFile}. Appending them now.`)
      console.log(`[TREE-GEN] 在 ${targetFile} 中未找到标记。正在追加...`)
      const mdTags = `\n\n${TREE_START_TAG}\n<!-- Your directory tree will appear here -->\n${TREE_END_TAG}\n`
      await fs.appendFile(targetFile, mdTags)
      console.log(`✅ [TREE-GEN] Tags appended. Please run the command again to generate the tree.`)
      console.log(`✅ [TREE-GEN] 标记已追加。请重新运行命令以生成目录树。`)
      return // 优雅退出，让用户重新运行
    }

    console.log(`[TREE-GEN] Config and tags found. Starting tree generation...`)
    console.log(`[TREE-GEN] 配置和标记已找到，开始生成目录树...`)

    const descriptions = await (async () => {
      try {
        return yaml.load(await fs.readFile(descriptionsFile, 'utf-8')) || {}
      } catch (e) {
        return {}
      }
    })()
    const ignoreConfig = await loadIgnoreConfig(ignoreFile)
    const tree = dirTree(root, { attributes: ['type'], exclude: ignoreConfig.deep })

    const livePaths = []
    const collectPaths = (node) => {
      if (!node) return
      const relativePath = path.relative(path.resolve(root), node.path).replace(/\\/g, '/')
      if (relativePath === '') {
        livePaths.push('./')
      } else {
        const displayPath = relativePath + (node.type === 'directory' ? '/' : '')
        livePaths.push(displayPath)
      }
      const isShallowIgnored = ignoreConfig.shallow.some((regex) => regex.test(relativePath))
      if (node.children && !isShallowIgnored) {
        node.children.forEach(collectPaths)
      }
    }
    collectPaths(tree)
    await syncDescriptionsFile(descriptions, livePaths, descriptionsFile)

    const rootDirName = path.basename(path.resolve(root))
    const rootDisplayName = `${rootDirName}/`
    const rootLookupKey = './'
    const rootDescription = descriptions[rootLookupKey] || ''
    const rootDescriptionText = rootDescription ? ` # (${rootDescription})` : ''
    const rootLine = `${rootDisplayName}${rootDescriptionText}\n`
    const treeString = buildTreeString(tree, descriptions, ignoreConfig, '')
    const finalTreeOutput = '```\n' + rootLine + treeString.trim() + '\n```'

    const updatedMdContent = await fs.readFile(targetFile, 'utf-8')
    const startTagIndex = updatedMdContent.indexOf(TREE_START_TAG)
    const endTagIndex = updatedMdContent.indexOf(TREE_END_TAG)

    const newMdContent =
      updatedMdContent.substring(0, startTagIndex + TREE_START_TAG.length) +
      `\n<!-- This tree is automatically generated. Do not edit manually. -->\n` +
      finalTreeOutput +
      `\n` +
      updatedMdContent.substring(endTagIndex)

    await fs.writeFile(targetFile, newMdContent, 'utf-8')
    console.log(`✅ [TREE-GEN] Successfully updated tree in ${targetFile}.`)
    console.log(`✅ [TREE-GEN] 已成功更新目录树于 ${targetFile}。`)
  } catch (error) {
    if (error.code === 'ENOENT' && error.path.includes('tree-config.mjs')) {
      // 捕获到 fs.access 的 ENOENT 错误，执行首次安装
      console.log(`[TREE-GEN] Main config file ('tree-config.mjs') not found in script directory.`)
      console.log('[TREE-GEN] Running one-time setup...')
      console.log(`[TREE-GEN] 在脚本目录中未找到主配置文件 ('tree-config.mjs')。`)
      console.log(`[TREE-GEN] 正在运行首次安装程序...`)

      await initializeConfiguration()

      console.log(`\n✅ [TREE-GEN] Setup complete! All necessary files have been created.`)
      console.log(
        `   Please review the generated files, especially '${path.join('scripts/md-tree-updater', 'tree-config.mjs')}',`
      )
      console.log(`   and then run the command again.`)
      console.log(`✅ [TREE-GEN] 安装完成！所有必需的文件均已创建。`)
      console.log(
        `   请检查生成的文件，特别是位于 '${path.join('scripts/md-tree-updater', 'tree-config.mjs')}' 的配置文件，`
      )
      console.log(`   然后再次运行命令。`)
      return
    }
    // 抛出所有其他未被捕获的错误
    console.error('[TREE-GEN] An unexpected error occurred:', error)
    process.exit(1)
  }
}

// --- 脚本入口 ---
main()
