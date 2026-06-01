# SITCON Credits Profiles

如果你曾參與 SITCON 相關活動，可以在這裡新增或更新自己願意公開顯示的 profile，讓 SITCON Credits 顯示你偏好的名稱、簡介、頭像、公開 email 與連結。

你可以只用 GitHub 網頁完成，不需要安裝 git，也不需要會寫程式。這份 profile 只放你本人自願公開的資料；如果不確定某個欄位能不能公開，先留空就好。

這裡不新增或修改歷史貢獻紀錄，也不會自動完成身份連結。歷史活動紀錄、角色、來源 URL 與身份連結審核仍由 [SITCON Credits](https://github.com/sitcon-tw/credits) 維護。

## 三分鐘版本

1. 登入 GitHub，打開 [`profiles/`](https://github.com/sitcon-tw/credits-profiles/tree/master/profiles)。
2. 新增或更新 `profiles/<你的 GitHub username>.json`。
3. 只填你本人願意公開的資料；不知道要不要公開的欄位就留空。
4. 送出 Pull Request，也就是請維護者檢查並合併你的修改。
5. 在 Pull Request 說明中勾選確認事項。

自助流程只適合用自己的 GitHub 帳號修改自己的單一 profile 檔。如果要幫別人、改別人的檔案、刪除或搬移 profile，請先讓維護者協助。

## 快速入口

| 你想做什麼 | 請看 |
| --- | --- |
| 用 GitHub 網頁新增自己的 profile | [新增 profile](#新增-profile) |
| 用 GitHub 網頁更新既有 profile | [更新既有 profile](#更新既有-profile) |
| 請 Codex、Claude Code 等 agent 協助 | [請-agent-協助](#請-agent-協助) |
| 看可複製的完整範例 | [`profiles/denny0223.json`](profiles/denny0223.json) |
| 看完整欄位格式 | [profile 檔案格式](profiles/README.md) |
| 理解 Pull Request 送出後會發生什麼事 | [自助 profile PR 流程](docs/workflows.md) |

## 開始前先準備

每一項都可以留空；只填你願意公開出現在網路上的資料。

| 欄位 | 說明 |
| --- | --- |
| GitHub username | profile 檔名會是 `profiles/<github_username>.json`。 |
| `display_name` | 你希望公開顯示的名稱，可以留空。 |
| `bio` | 你自願公開的一句到幾句簡短介紹，可以留空。 |
| `avatar_url` | 你自願公開的頭像圖片網址，必須是 `https://`，可以留空。 |
| `public_email` | 只有願意讓這個 email 出現在公開頁面、搜尋引擎、爬蟲或第三方保存時才填，可以留空。 |
| `links` | 你自願公開的連結清單，例如 GitHub、個人網站、作品集或公開社群頁，可以留空。 |

請不要填私人 email、電話、地址、證件資料、內部聯絡方式、別人的資料、歷史活動紀錄，或「哪些歷史紀錄是我」的身份合併宣告。

## 新增 profile

1. 登入 GitHub。
2. 打開 [`sitcon-tw/credits-profiles` 的 `profiles/` 資料夾](https://github.com/sitcon-tw/credits-profiles/tree/master/profiles)。
3. 按右上角 `Add file`，選 `Create new file`。也可以直接打開 [新增 profile 檔案頁面](https://github.com/sitcon-tw/credits-profiles/new/master/profiles)。
4. 在檔名欄輸入 `profiles/<你的 GitHub username>.json`，例如 `profiles/octocat.json`。
5. 複製 [`profiles/_template.json`](profiles/_template.json) 的內容貼上。
6. 只修改雙引號裡的內容；不想公開的欄位保留空字串 `""`，不想公開連結就保留 `"links": []`。
7. 按 `Commit changes...`。
8. 選擇建立新 branch，接著按 `Propose changes` 或 `Create pull request`。
9. 在 Pull Request 頁面勾選確認事項，送出。

如果想看填完整後的樣子，可以參考 [`profiles/denny0223.json`](profiles/denny0223.json)。請只參考欄位結構，不要保留範例中的名稱、email、連結或頭像。

你不需要一次填滿所有欄位。只想先公開顯示名稱或簡介也可以。

## 更新既有 profile

1. 打開 `profiles/<你的 GitHub username>.json`。可以從 [`profiles/`](https://github.com/sitcon-tw/credits-profiles/tree/master/profiles) 找到自己的檔案。
2. 按右上角鉛筆圖示 `Edit this file`。
3. 修改你想更新的欄位。
4. 按 `Commit changes...`。
5. 選擇建立新 branch，接著建立 Pull Request。
6. 在 Pull Request 頁面勾選確認事項，送出。

請只新增或修改 `profiles/<你的 GitHub username>.json`。不要修改 [`site-profiles/`](site-profiles/README.md)，那是維護者整理活動網站顯示資料用的資料夾。

## JSON 常見注意事項

- 每個文字都要用雙引號包住，例如 `"display_name": "SITCON 夥伴"`。
- 最後一筆資料後面不要多逗號。
- 不想填的文字欄位請保留 `""`。
- 不想公開任何連結請保留 `"links": []`。
- 不要新增 [profile 檔案格式](profiles/README.md) 沒有列出的欄位。
- `links` 最多 8 筆，所有 `url` 都必須是 `https://`。
- 標準連結只填 `type` 與 `url`；只有 `type` 是 `custom` 時才填 `label`。

## Gravatar 頭像

如果你已經有 Gravatar 頭像，可以把 Gravatar 圖片網址填到 `avatar_url`。這是選填欄位；不確定時留空就好。

Gravatar 目前使用把 email 去掉前後空白、轉成小寫後的 SHA-256 hash 作為 avatar URL 識別碼。網址格式是：

```text
https://gravatar.com/avatar/<sha256(email)>?s=512&r=g
```

會用終端機的人可以用這個方式取得 hash：

```bash
printf '%s' 'your-email@example.com' | tr '[:upper:]' '[:lower:]' | sha256sum
```

請把 `your-email@example.com` 換成你要用於 Gravatar 的 email。不要把不想公開或不想被關聯的 email 拿來產生頭像網址；email hash 仍可能被猜測或被拿來比對。如果不確定，`avatar_url` 可以留空，或使用你已經公開的 `https://` 頭像圖片網址。

Gravatar 開發文件可參考 [Avatars - Gravatar For Developers](https://docs.gravatar.com/sdk/images/)。

## 請 agent 協助

如果你使用 Codex、Claude Code 或其他 coding agent，可以把下面這段貼給 agent，再補上你願意公開的資料。請優先讓 agent 使用你已經登入或授權的 GitHub connector、skill、app 或內建 Pull Request 發布功能。

如果 agent 表示不能直接建立 Pull Request，請讓它提供 GitHub 網頁操作用的 branch、檔案內容、commit message 與 Pull Request 說明；你不需要為了這個流程安裝或登入 GitHub CLI。

送出 Pull Request 前，仍請自己確認檔案內容，因為 profile 會公開顯示在網路上。

```text
請協助我在 SITCON Credits Profiles repository 新增或更新我自己的公開 profile，並協助我送出 Pull Request；如果你目前的環境不能直接送 Pull Request，請改成提供我可以用 GitHub 網頁手動送出的內容與步驟。

Repository:
https://github.com/sitcon-tw/credits-profiles

請只處理這個檔案：
profiles/<我的 GitHub username>.json

我的 GitHub username 是：
<請填 GitHub username>

我明確同意公開在 profile 裡的資料如下。沒有列出的資料請不要加入、推測、搜尋或補完：

display_name:
<請填公開顯示名稱，或留空>

bio:
<請填願意公開的簡短介紹，或留空>

avatar_url:
<請填願意公開使用的頭像 URL，或留空>

public_email:
<請填願意公開的 email，或留空>

links:
<請填願意公開的連結清單，例如 website、github、linkedin、mastodon 等；沒有就留空>

工作方式：

1. 請優先使用你目前已經可用、且我已登入或授權的 GitHub connector、GitHub skill、GitHub app、內建 Pull Request 發布功能，或等效的受託整合來建立 branch 與 Pull Request。
2. 不要要求我安裝、設定或登入 GitHub CLI（gh）、git credential helper、SSH key，或其他命令列發布工具。
3. 如果你不能直接建立 Pull Request，請不要改成要求安裝 CLI。請改為輸出以下內容，讓我用 GitHub 網頁完成：
   - 建議 branch 名稱
   - 要建立或更新的檔案路徑
   - 可直接貼上的完整 JSON 內容
   - 建議 commit message
   - 建議 Pull Request title
   - 建議 Pull Request description
   - 使用 GitHub 網頁建立或更新檔案、建立 Pull Request、勾選確認事項的步驟
4. 如果你能在本機修改檔案，完成後請執行 `pnpm profiles:validate`。如果 repository 文件要求，請再執行 `pnpm test`。
5. 送出或準備 Pull Request 前，請檢查 diff，確認只修改了 `profiles/<我的 GitHub username>.json`。

安全限制：

1. 只能使用我在這段 prompt 中明確提供、且願意公開的資料。
2. 不要加入私人資訊、未公開 email、電話、地址、身份文件、內部聯絡資訊，或任何我沒有明確提供的資料。
3. 不要加入別人的資料。
4. 不要加入歷史活動紀錄、貢獻紀錄、角色紀錄、活動出現紀錄、source URL，或任何身份合併／身份確認宣告。
5. 不要根據姓名、暱稱、GitHub 帳號、相似拼音、搜尋結果、既有記憶或外部資料推測我是誰。
6. 不要搜尋網路或其他 repository 來補完我的個人資料。
7. 不要要求我提供 GitHub token、密碼、cookie、SSH private key 或其他登入憑證。
8. 不要修改 `site-profiles/`。
9. 不要修改 schema、workflow、template、README、其他人的 profile，或任何與我的 `profiles/<github_username>.json` 無關的檔案。
10. 如果資料不足、格式不確定，或你需要更多資訊，請先問我，不要自行補完。

Pull Request 說明請簡短寫明這是新增或更新我本人自願公開的 profile。不要在 Pull Request 說明中宣稱這會更新 SITCON Credits 的歷史紀錄、身份合併資料，或主資料中的資料。
```

## 送出後如果檢查沒有通過

如果 Pull Request 頁面出現紅色叉叉或機器人留言，通常代表格式有小錯，例如少了逗號、檔名不是自己的 GitHub username、連結不是 `https://`，或 PR 勾選項目沒有完成。

你不用重開 Pull Request。回到你修改的檔案，按鉛筆圖示修正，再按 `Commit changes...`；同一個 Pull Request 會自動更新並重新檢查。

如果留言提到歷史紀錄或身份確認，請等維護者協助，不需要自行猜測修改。你也可以在 Pull Request 留言請維護者協助。

## 哪些情況需要維護者協助

- 想修改別人的 profile。
- 想同時新增或更新多個人的 profile。
- 想刪除、搬移或 rename profile。
- 想修正歷史活動紀錄、角色、顯示名稱或身份連結。
- 不確定某筆歷史貢獻是不是應該連到自己。
- GitHub 檢查留言看不懂。
- 需要更新 `site-profiles/`。

如果你希望某筆歷史貢獻紀錄連到你的 profile，可以在 Pull Request 說明中提出你認為對應的活動年份、活動名稱與當時顯示名稱，作為維護者審查的線索。這不會自動改動 SITCON Credits 的主資料，也不會自動完成身份連結。

## Pull Request 會怎麼被檢查

新增或更新 profile 的 Pull Request 可以自助處理的低風險範圍是：只修改 Pull Request 作者自己的單一 `profiles/<github_username>.json`。送出後：

- `Check profile PR scope` 會確認 Pull Request 是否只修改自己的單一 profile 檔。
- `Check trusted profile PR` 會用 base repository 的可信任程式碼檢查 profile JSON 格式與 Pull Request template 必要確認事項。
- 通過後會交由 `sitcon-tw/credits` 的流程，根據主資料確認這個 username 是否已出現在歷史貢獻紀錄的 `github_username`。
- 符合低風險條件時，系統可能自動核准並合併。
- 如果 username 尚未出現在歷史貢獻紀錄，workflow 會留言提醒維護者先確認或調整主資料，不會自動建立身份連結。

刪除 profile、rename profile、修改 template/schema/docs/workflow、或修改他人的 profile，都需要維護者人工 review，並以 `profile-scope-reviewed` label 明確標記已審查此 Pull Request 的 profile 範圍。`site-profiles/` 不走這個 Pull Request review 路徑；若要更新，應由維護者直接 commit。

完整流程請看 [自助 profile PR 流程](docs/workflows.md)。

## 驗證

本 repo 使用 pnpm。請不要使用 npm、yarn 或 bun 產生 lockfile。

```bash
pnpm profiles:validate
pnpm site-profiles:validate
pnpm test
```

`profiles:validate` 只檢查 profile 檔案格式、檔名、URL、public email 格式與基本資料最小化規則。它不會審核身份連結、歷史紀錄修正、移除請求或隱私政策例外。

`site-profiles:validate` 只檢查 `site-profiles/` 的活動網站來源顯示資料格式。它不會把 site profile 視為本人自願公開，也不會建立 GitHub username 身份連結。

## 與 SITCON Credits 的關係

`credits-profiles` 的 profile 檔案 merge 到 `master` 後，會觸發 `sitcon-tw/credits` 的 people helper 同步 workflow，讓 Google Sheets 的 `people` helper sheet 出現該 profile username 與 display name。這只是維護提示，不會更改歷史貢獻紀錄或核准身份連結。

`site-profiles/` 存放維護者從歷屆活動公開網站整理出的顯示用名稱與頭像。它不是本人自願公開 profile，也不接受一般 Pull Request 修改。`site-profiles/` 不會觸發 people helper 同步，也不會讓任何 `site:<source_person_id>` 變成可自助編輯的 GitHub profile。

未來 [SITCON Credits](https://github.com/sitcon-tw/credits) 的建置流程可以 checkout 或下載本 repo 的 profile 資料，產生公開網站需要的個人資料索引。GitHub Pages 建置整合尚未啟用前，請不要把它描述為已上線。

## 授權與資料使用

本 repo 的程式、設定與文件以 [MIT License](LICENSE) 授權。

`profiles/*.json` 中的個人公開 profile 資料是 contributor 自願提供給 SITCON Credits 公開呈現的資料。`site-profiles/**/*.json` 是由維護者從公開活動網站整理的顯示用資料。使用脈絡、public email 邊界與主 repo 的主資料關係請看 [資料使用聲明](DATA_USAGE.md)。
