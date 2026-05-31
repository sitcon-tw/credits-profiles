# SITCON Credits Profiles

SITCON Credits Profiles 是 SITCON Credits 的個人公開資料 repository。這裡只存放曾經參與 SITCON 相關活動的夥伴自願公開的 profile 資料，例如偏好的顯示名稱、簡介、頭像、公開 email 與公開連結。

歷史活動紀錄、角色、來源 URL 與身份連結審核仍由 [SITCON Credits](https://github.com/sitcon-tw/credits) 維護。某個 GitHub username 有 profile 檔案，只代表該 username 有一份 opt-in 公開資料，不代表任何歷史 appearance 已經自動連到這個人。

## 快速入口

| 你想做什麼 | 請看 |
| --- | --- |
| 新增或更新自己的 profile | [profile 檔案格式](profiles/README.md) |
| 理解 Pull Request 送出後會發生什麼事 | [自助 profile PR 流程](docs/workflows.md) |
| 了解主 repo 的資料模型與身份審核邊界 | [SITCON Credits 資料模型與治理](https://github.com/sitcon-tw/credits/blob/master/docs/data-model.md) |
| 了解完整跨 repo 自動化 | [SITCON Credits 自動化流程](https://github.com/sitcon-tw/credits/blob/master/docs/workflows.md) |

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

如果你希望某筆歷史貢獻紀錄連到你的 profile，可以在 PR 說明中提出你認為對應的活動與名稱，作為維護者審查的線索。這不會自動改動 SITCON Credits 的 canonical 資料，也不會自動完成身份合併。

## Pull Request 會怎麼被檢查

自助 profile PR 的低風險範圍是：只修改 PR 作者自己的單一 `profiles/<github_username>.json`。送出 PR 後：

- `Check profile PR scope` 會確認 PR 是否只修改自己的單一 profile 檔。
- `Check trusted profile PR` 會用 base repository 的可信任程式碼檢查 profile JSON 格式與 PR template 必要確認事項。
- 通過後會 dispatch 到 `sitcon-tw/credits`，由主 repo 使用 canonical Google Sheets 檢查這個 username 是否已出現在 `appearances.github_username`。
- 符合條件時，`SITCON Credits Assistant` GitHub App 可以核准並以 squash merge 合併 PR。
- 如果 username 尚未出現在 appearances，workflow 會留言提醒維護者先確認或調整 canonical data，不會自動建立身份連結。

刪除 profile、rename profile、修改 template/schema/docs/workflow、或修改他人的 profile，都需要維護者人工 review，並以 `profile-scope-reviewed` label 明確標記已審查此 PR 的 profile 範圍。

## 驗證

本 repo 使用 pnpm。請不要使用 npm、yarn 或 bun 產生 lockfile。

```bash
pnpm profiles:validate
pnpm test
```

`profiles:validate` 只檢查 profile 檔案格式、檔名、URL、public email 格式與基本資料最小化規則。它不會審核身份連結、歷史紀錄修正、移除請求或隱私政策例外。

## 與 SITCON Credits 的關係

`credits-profiles` 的 profile 檔案 merge 到 `master` 後，會觸發 `sitcon-tw/credits` 的 people helper 同步 workflow，讓 Google Sheets 的 `people` helper sheet 出現該 profile username 與 display name。這只是維護提示，不會更改歷史 appearances 或核准身份連結。

未來 [SITCON Credits](https://github.com/sitcon-tw/credits) 的建置流程可以 checkout 或下載本 repo 的 profile 資料，產生公開網站需要的個人資料索引。GitHub Pages 建置整合尚未啟用前，請不要把它描述為已上線。

## 授權與資料使用

本 repo 的程式、設定與文件以 [MIT License](LICENSE) 授權。

`profiles/*.json` 中的個人公開 profile 資料是 contributor 自願提供給 SITCON Credits 公開呈現的 opt-in 資料。使用脈絡、public email 邊界與主 repo 的 canonical data 關係請看 [資料使用聲明](DATA_USAGE.md)。
