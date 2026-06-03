# SITCON Credits Profiles

這個儲存庫保存 SITCON Credits 貢獻者自願公開顯示的個人公開資料。你可以提供偏好的公開顯示名稱、簡介、頭像、公開 email 與公開連結。

這裡不新增或修改歷史貢獻紀錄，也不會自動完成身份連結。歷史活動紀錄、角色、來源 URL 與身份連結審核仍由 [SITCON Credits](https://github.com/sitcon-tw/credits) 維護。

## 開始填寫

請先登入 GitHub，然後打開：

[新增或更新個人公開資料表單](https://github.com/sitcon-tw/credits-profiles/issues/new?template=profile-request.yml)

如果還沒有 GitHub 帳號，請先到 [GitHub 註冊頁面](https://github.com/signup) 建立帳號，再回來填寫表單。這個流程需要 GitHub username，系統會用它建立 `profiles/<GitHub username>.json`。

表單送出後會建立公開的 GitHub issue。請只填你本人願意公開顯示在 SITCON Credits 的資料；不知道要不要公開的欄位可以留空。

## 可以填哪些資料

| 欄位 | 說明 |
| --- | --- |
| 公開顯示名稱 | 必填。你希望在 SITCON Credits 上公開顯示的名稱。 |
| 公開簡介 | 選填。一句到幾句自願公開的簡短介紹。 |
| 頭像 | 選填。留空時會使用 GitHub 公開頭像；也可以填 Gravatar SHA-256 hash 或進階圖片 URL。 |
| 公開 email | 選填。只有願意讓 email 公開顯示、被搜尋引擎或第三方保存時才填。 |
| 公開連結 | 選填。GitHub、個人網站、Blog、Instagram、Telegram、LinkedIn、Facebook、YouTube、Slides、GitLab、Discord、Mastodon、Threads、X 或自訂連結。 |
| 貢獻紀錄線索 | 選填。若你看到公開貢獻紀錄中可能是在記錄你本人的資料，可以提供給維護者人工確認。 |

請不要填私人 email、電話、地址、證件資料、內部聯絡方式、未經同意公開的他人資料，或任何你不確定是否能公開的內容。

## 送出後會發生什麼

1. `SITCON Credits Assistant` 會讀取表單內容。
2. 系統會使用你送出 issue 的 GitHub 帳號，建立或更新 `profiles/<GitHub username>.json`。
3. 系統會建立 Pull Request，並在原本的 issue 留下 PR 連結。
4. 如果格式有問題，assistant 會在 issue 或 PR 留言提醒；你可以直接編輯 issue 內容或等待維護者協助。
5. PR 合併後，issue 會因為 PR 關聯自動關閉。

自動建立 PR、通過檢查或合併 profile，都不代表身份連結已經核准，也不代表 Google Sheets 的歷史貢獻紀錄已經修改。

## 頭像補充

頭像欄位可以全部留空，系統會預設使用你的 GitHub 公開頭像。

進階使用者也可以自行提供願意公開的 `https://` 圖片網址。請不要填私人相簿、需要登入才能看的圖片，或你不確定授權的圖片。

## 請 agent 協助

如果你熟悉 Codex、Claude Code 或其他 coding agent，可以請 agent 幫你整理資料、檢查格式或直接建立 Pull Request。這比較適合已經知道 GitHub、PR、JSON 是什麼的人；一般填寫者建議直接使用表單。

可複製的完整 prompt 請看：[CONTRIBUTING.md](CONTRIBUTING.md)。

請注意：

- 只讓 agent 使用你明確提供、願意公開的資料。
- 不要讓 agent 搜尋、推測或補完你的個人資料。
- 不要讓 agent 修改 `site-profiles/`、schema、workflow、文件或其他人的 profile。
- 送出 PR 前，請先確認完整 JSON、PR 說明與 diff。

如果 agent 要直接改檔，請只處理 `profiles/<你的 GitHub username>.json`，並執行：

```bash
pnpm profiles:validate
```

需要理解自助 PR 檢查與跨 repo 自動化時，請看 [自助 profile PR 流程](docs/workflows.md)。

## 維護者與技術參考

- profile 欄位格式：[profiles/README.md](profiles/README.md)
- 範例檔案：[profiles/_template.json](profiles/_template.json)
- agent 協助 prompt：[CONTRIBUTING.md](CONTRIBUTING.md)
- workflow 說明：[docs/workflows.md](docs/workflows.md)
- 資料使用聲明：[DATA_USAGE.md](DATA_USAGE.md)

本儲存庫使用 pnpm。維護者修改程式、schema、文件或資料後，請依變更範圍執行：

```bash
pnpm profiles:validate
pnpm site-profiles:validate
pnpm test
```

`profiles:validate` 只檢查 profile 檔案格式、檔名、URL、public email 格式與基本資料最小化規則。它不會審核身份連結、歷史紀錄修正、移除請求或隱私政策例外。

`site-profiles/` 存放維護者從歷屆活動公開網站整理出的顯示用名稱與頭像。它不是本人自願公開 profile，也不接受一般 Pull Request 修改。`site-profiles/` 不會觸發 people helper 同步，也不會讓任何 `site:<source_person_id>` 變成可自助編輯的 GitHub profile。

## 授權與資料使用

本儲存庫的程式、設定與文件以 [MIT License](LICENSE) 授權。

`profiles/*.json` 中的個人公開 profile 資料是貢獻者自願提供給 SITCON Credits 公開呈現的資料。`site-profiles/**/*.json` 是由維護者從公開活動網站整理的顯示用資料。使用脈絡、public email 邊界與主儲存庫的主資料關係請看 [資料使用聲明](DATA_USAGE.md)。
