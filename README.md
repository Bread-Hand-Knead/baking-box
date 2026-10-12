# 烘焙靈感箱 Baking Box

個人烘焙食譜整理 App：記錄食譜、配方換算、心得筆記，並用 AI 自動解析貼上的食譜。

- 網站：https://bread-hand-knead.github.io/baking-box/
- 前端：React + Vite，推送到 `main` 後由 GitHub Actions 自動發布到 GitHub Pages
- 後端：Firebase（登入、Firestore 資料庫、Cloud Functions）

## AI 功能

AI 解析由後端 Cloud Function `aiGenerate`（asia-east1）呼叫 Gemini，金鑰只存在 Firebase Secret Manager，前端不需要也看不到金鑰。

更換金鑰：

```
firebase functions:secrets:set GEMINI_API_KEY --project gen-lang-client-0977550961
```

部署後端：

```
firebase deploy --only functions:aiGenerate --project gen-lang-client-0977550961
```

## 本機開發

```
npm install
npm run dev
```
