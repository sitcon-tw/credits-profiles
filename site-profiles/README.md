# 活動網站來源 profile

`site-profiles/` 存放從歷屆活動公開網站整理出的顯示用 profile。這些資料讓 SITCON Credits 前端在尚未有本人 opt-in profile 時，也能依照官方活動網站資料顯示名稱與頭像。

這個資料夾只接受維護者直接 commit，不接受一般 Pull Request 修改。若本人想提供或更新自己的公開 profile，請改到 `profiles/<github_username>.json` 送出自助 profile PR。

## 路徑

```text
site-profiles/<event_id>/<source_person_id>.json
```

`<event_id>` 對應 SITCON Credits canonical Sheet 的 `events.event_id`。`<source_person_id>` 是同一場活動來源網站中的短 ID，Sheet 的 `appearances.github_username` 會寫成：

```text
site:<source_person_id>
```

## 欄位

site profile 只允許兩個欄位：

| 欄位 | 說明 |
| --- | --- |
| `display_name` | 活動網站上的公開顯示名稱。 |
| `avatar_url` | 活動網站上的公開頭像 URL；必須是 `https://`，沒有頭像時可留空字串。 |

範例：

```json
{
  "display_name": "SITCON 講者",
  "avatar_url": "https://example.com/avatar.png"
}
```

site profile 不是本人 opt-in profile、不代表身份合併，也不會同步到 Google Sheets 的 `people` helper。
