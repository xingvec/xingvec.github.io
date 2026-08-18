# Xingvec's Blog

Hugo + GitHub Pages 博客。

## 写新文章

1. 在 `content/posts/` 下新建 `.md` 文件
2. 文件开头必须有 front matter：

```markdown
---
title: "文章标题"
date: 2026-08-18
draft: false
---

正文内容...
```

3. 提交推送：

```bash
git add .
git commit -m "新文章：标题"
git push
```

4. 等 1 分钟，博客自动更新。
