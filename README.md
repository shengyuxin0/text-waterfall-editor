# 文字水流编辑器

一个基于 p5.js 的文字水流网页工具。支持上传图片或视频作为背景，点击画面生成最多两条文字水流，并调整画幅、画质、字号、选中框和底部堆积范围。

## 本地预览

直接打开 `index.html` 即可预览。也可以在当前目录启动静态服务器：

```bash
python3 -m http.server 56693
```

然后访问：

```text
http://localhost:56693/
```

## 发布到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `text-waterfall-editor`。
2. 上传这些文件到仓库根目录：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. 进入仓库的 `Settings`。
4. 打开 `Pages`。
5. 在 `Build and deployment` 里选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. 保存后等待几十秒到几分钟。
7. GitHub 会生成一个公网链接，格式通常类似：

```text
https://你的用户名.github.io/text-waterfall-editor/
```

## 使用提醒

上传的图片或视频只存在用户当前浏览器里，不会被自动上传到服务器。
