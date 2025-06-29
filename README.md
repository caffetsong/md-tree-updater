# md-tree-updater🌳
一个在Markdown文件中，自动生成并更新项目目录树的工具

## 🤖 AI使用说明
> 该脚本工具由AI生成，所有英语说明由AI生成。


## 解决了什么问题？
- 喜欢在生成的目录树中为每个文件/文件夹**添加描述**。
- 厌倦了每次增删文件后，都要**手动更新** `README.md` 里的项目结构树。

## ✨ 功能
- **目录树**：根据文件结构生成目录树
- **描述配置**：在描述配置文件 `descriptions.yml` 中维护描述，即使tree变了，描述也不会改变
- **智能同步**: 自动发现新文件并在描述配置文件中添加条目
- **灵活忽略**: 配置**深度忽略**（完全隐藏）或**浅忽略**（只显示文件夹名，不展开内容）
-  **合理排序**：保证与常见文件管理器的显示保持一致
- **注入模式**: 使用 `<!-- TREE_START -->` 和 `<!-- TREE_END -->` 标记，将目录树精确地更新到您Markdown文件的指定位置



## 🛠️ 环境要求
本工具基于 **Node.js** 构建。在运行前，请确保您已经安装了 **[Node.js]**

您可以在终端中运行以下命令来检查是否已成功安装：
```bash
node -v
npm -v
```

## 🚀 使用步骤
本项目是一个可以直接使用的“模板”，而不是一个需要安装的NPM包。请遵循以下步骤，将此工具集成到您现有的项目中。

### 1. 复制文件
将下载得到的 `md-tree-updater.mjs`和`tree-config.mjs`，复制到您项目根目录的`script`文件夹中

> 为了方便说明，我们假定您将其放在了 `your-project/scripts/`。

### 2. 安装依赖

在您项目 (`your-project`) 的根目录下，打开终端，运行以下命令来安装此脚本所需的依赖。这会将依赖项添加到您自己的`package.json`中。

```bash
npm install directory-tree js-yaml --save-dev
```

### 3. 注册脚本命令

打开您项目根目录下的 `package.json` 文件，在 `"scripts"` 字段中，添加一个新的命令：

```json
"scripts": {
  "//": "其他已有脚本...",
  "tree:update": "node scripts/md-tree-updater.mjs"
},
```
> **注意**: 请确保 `node` 后面的路径，与您在第一步中放置`md-tree-updater.mjs`的实际路径一致。

### 4. 运行！
在您项目 (`your-project`) 的根目录下，运行以下命令来使用此工具

```bash
npm run tree:update
```
> **首次使用**: 运行后会根据 `tree-config.mjs` 的配置，自动生成所需的配置文件和目标Markdown文件。为了避免不必要的麻烦，建议在运行脚本前先自行编辑 `tree-config.mjs`。

## 配置文件说明
最终你的项目会有以下文件
```
your-project/
├─ script/
│  ├─ md-tree-updater.mjs
│  └─ tree-config.mjs
├─ README.md
├─ .treeignore
└─ tree-descriptions.yml
```
 ---
### 1. 脚本主文件: `md-tree-updater.mjs`
这是执行所有逻辑的核心脚本文件。

### 2. 配置主文件: `tree-config.mjs`
在这里配置其他文件的路径，脚本主文件会根据此配置来工作和生成文件。
        
```JavaScript
export const config = {
  root: '.',//你的根目录，一般不修改
  targetFile: 'README.md',//将添加目录树的Markdown文件
  descriptionsFile: 'tree-descriptions.yml',//在此为目录树中添加描述
  ignoreFile: '.treeignore',//忽略规则文件
};
```




### 3. 忽略配置文件: `.treeignore`
在这里配置忽略规则，规则分为两种：
以 "/" 结尾为不完全忽略

| 规则语法 | 效果 | 说明 |
| :--- | :--- | :--- |
| `node_modules/` | **不完全忽略** | 文件夹本身会显示在树中，但其内部的所有内容都将被隐藏。 |
| `.git` | **完全忽略** | 文件或目录将完全从树中隐藏，如同不存在一样。 |

**示例 `.treeignore` 内容:**
```
# --- 不完全忽略 ---
node_modules/
dist/
build/
.vscode/

# --- 完全忽略 ---
.git
.idea
.DS_Store
```



### 4. 目标md文件: `README.md`
这是最终将被更新的Markdown文件。若你的文件没有此标记，会添加一次标记，您需要再次运行一次脚本才会添加目录树：
```markdown
<!-- TREE_START -->
<!--你的目录树将会显示在标记之间 -->
<!-- TREE_END -->
```

### 5. 描述配置文件: `tree-descriptions.yml`
您可以在此为项目中的文件或目录添加描述。当然，您也可以不添加任何描述。
```yaml
# 在此处为文件或目录添加描述，格式为 "'路径/': '你的描述'"。
# 示例:
'scripts/md-tree-updater/': '存放目录树更新器的相关脚本'
'README.md': '项目的主说明文档'
```






