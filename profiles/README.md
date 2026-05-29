# 個人公開資料檔案

這個資料夾用來放曾經參與 SITCON 相關活動的夥伴自願提供的公開個人資料。每個 profile 檔案只代表一個 GitHub username 可自行維護的公開簡介，不是歷史貢獻紀錄本身，也不是身份合併的證明。

## 檔名

profile 檔案放在 `profiles/` 底下，檔名使用 GitHub username：

```text
profiles/<github_username>.json
```

例如 GitHub username 是 `octocat`，檔案就是：

```text
profiles/octocat.json
```

GitHub username 只能使用 GitHub 支援的格式：英文字母、數字與 `-`，長度最多 39 個字元，不能以 `-` 開頭或結尾。

## 可以填寫的欄位

請從 `_template.json` 複製一份，改成自己的 GitHub username 檔名，再填寫以下欄位。若想先看完整填寫方式，可以參考 `_example.json`。

| 欄位 | 說明 |
| --- | --- |
| `display_name` | 你希望在 SITCON Credits 顯示的公開名稱。可以留空，留空時網站可 fallback 到 GitHub username。 |
| `bio` | 你自願公開的簡短介紹。可以留空。 |
| `avatar_url` | 你自願公開的頭像圖片 URL。請使用 `https://` URL；可以留空。 |
| `links` | 你自願公開的連結清單，例如 GitHub、個人網站或公開社群頁。每筆連結包含 `type` 與 `url`；只有 `type` 是 `custom` 時才需要填 `label`。 |

範例：

```json
{
  "$schema": "../schemas/profile.schema.json",
  "display_name": "SITCON 夥伴",
  "bio": "曾參與 SITCON 相關活動，關心學生社群與開源協作。",
  "avatar_url": "https://example.com/avatar.png",
  "links": [
    {
      "type": "github",
      "url": "https://github.com/octocat"
    },
    {
      "type": "custom",
      "label": "個人網站",
      "url": "https://example.com"
    }
  ]
}
```

## 公開連結格式

標準服務請使用固定的 `type`，不要自行填寫顯示名稱。網站前端會依照 `type` 決定標準名稱、圖示與呈現方式。

目前支援的標準 `type`：

```text
github
gitlab
website
blog
linkedin
facebook
instagram
threads
x
discord
telegram
mastodon
youtube
slides
```

標準連結範例：

```json
{
  "type": "github",
  "url": "https://github.com/octocat"
}
```

如果你的公開連結不屬於上面的標準服務，請使用 `custom`，並填寫公開顯示用的 `label`：

```json
{
  "type": "custom",
  "label": "公開作品集",
  "url": "https://example.com/portfolio"
}
```

`links` 中所有 `url` 都必須使用 `https://`。如果你不想公開任何連結，請保留：

```json
"links": []
```

## 不應放入 profile 檔案的內容

profile 檔案只放本人 opt-in 的公開簡介資料。請不要在這裡放：

- 私人 email、電話、地址、證件資料或內部聯絡資訊。
- 未經本人同意公開的社群帳號。
- 歷史活動角色、組別、來源 URL 或活動紀錄修正。
- 「這些 appearance 是我」的身份合併宣告。
- 其他人的姓名、別名、身份線索或推測。

如果你希望某個歷史貢獻紀錄連到你的 profile，可以在 Pull Request 說明中提出你認為對應的活動與名稱，作為維護者審查的線索。這不會自動改動 Google Sheets 中的 `appearances.github_username`，也不會自動完成身份合併。

## 驗證

送出 Pull Request 前，可以執行：

```bash
pnpm profiles:validate
```

這個檢查會確認檔名、欄位、URL 與基本資料最小化規則。它不會連線 Google Sheets，也不會讀取 service account credentials。

## 目前流程狀態

目前這個資料夾提供 profile 檔案格式、空白範本與本機驗證。GitHub Actions 自動建立空白 template、自動檢查 PR 作者是否符合檔名，以及低風險 profile 更新的自動接受流程都尚未啟用。
