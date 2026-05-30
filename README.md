# SITCON Credits Profiles

SITCON Credits Profiles 是 SITCON Credits 的個人公開資料 repository。

這裡只存放曾經參與 SITCON 相關活動的夥伴自願公開的 profile 資料，例如偏好的顯示名稱、簡介、頭像、公開 email 與公開連結。歷史活動紀錄、角色、來源 URL 與身份連結審核仍由 [SITCON Credits](https://github.com/sitcon-tw/credits) 維護。

## 為什麼獨立成 repo

[SITCON Credits](https://github.com/sitcon-tw/credits) 需要保存資料模型、Google Sheets 維護工具、匯出流程與未來網站建置邏輯；這些變更應該維持清楚、可審查的開發紀錄。

profile 則比較適合接受社群 Pull Request。每個人可能會多次修正自己的介紹、頭像或連結，commit message 與 PR 歷史自然會比較零散。將 profile 放在獨立 repo，可以讓自助更新流程與主系統開發紀錄分開治理，也讓未來的 PR 權限、驗證與自動化更容易只針對低風險 profile 欄位設計。

## 可以放什麼

profile 檔案放在：

```text
profiles/<github_username>.json
```

目前允許欄位只有：

- `display_name`：你希望公開顯示的名稱，可以留空。
- `bio`：你自願公開的簡短介紹，可以留空。
- `avatar_url`：你自願公開的 `https://` 頭像 URL，可以留空。
- `public_email`：你自願公開的 email，可以留空；只有願意讓這個 email 顯示在公開頁面時才填寫。
- `links`：你自願公開的連結清單。

完整格式請看：

- [profiles/README.md](profiles/README.md)
- [profiles/_template.json](profiles/_template.json)
- [schemas/profile.schema.json](schemas/profile.schema.json)

## 不可以放什麼

請不要在 profile 檔案中放：

- 私人 email、電話、地址、證件資料或內部聯絡資訊。
- 未經本人同意公開的 email；若要公開自己的 email，請只填在 `public_email`。
- 未經本人同意公開的社群帳號。
- 歷史活動角色、組別、來源 URL 或活動紀錄修正。
- 「這些 appearance 是我」的身份合併宣告。
- 其他人的姓名、別名、身份線索或推測。

如果你希望某筆歷史貢獻紀錄連到你的 profile，可以在 PR 說明中提出你認為對應的活動與名稱，作為維護者審查的線索。這不會自動改動 SITCON Credits 的 canonical data，也不會自動完成身份合併。

## 驗證

本 repo 使用 pnpm。請不要使用 npm、yarn 或 bun 產生 lockfile。

```bash
pnpm profiles:validate
pnpm test
```

`profiles:validate` 只檢查 profile 檔案格式、檔名、URL、public email 格式與基本資料最小化規則。它不會審核身份連結、歷史紀錄修正、移除請求或隱私政策例外。

## 與 SITCON Credits 的關係

未來 [SITCON Credits](https://github.com/sitcon-tw/credits) 的建置流程可以 checkout 或下載本 repo 的 profile 資料，產生公開網站需要的個人資料索引。這個整合流程尚未啟用前，請不要把它描述為已上線。

`credits-profiles` 不是身份合併權威。某個 GitHub username 有 profile 檔案，只代表該 username 有一份 opt-in 公開資料；歷史 appearance 是否連到該 username，仍以 SITCON Credits 中經維護者審核的 canonical data 為準。
