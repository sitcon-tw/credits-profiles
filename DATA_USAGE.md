# 資料使用聲明

本 repo 的程式、設定與文件以 [MIT License](LICENSE) 授權。

`profiles/*.json` 中的個人公開 profile 資料，是 contributor 自願提供給 SITCON Credits 公開呈現的 opt-in 資料。這些資料可能包含偏好的顯示名稱、簡介、頭像、公開 email 與公開連結。

`site-profiles/**/*.json` 中的活動網站來源 profile，是維護者從歷屆活動公開網站整理出的顯示用名稱與頭像。它不是本人 opt-in profile，不代表身份合併，也不接受一般 Pull Request 修改。

MIT License 不代表 profile 內容可以脫離 SITCON Credits 的公開感謝與貢獻紀錄脈絡，任意大量蒐集、重組、再發布或用於無關目的。

## 使用原則

- 使用 profile 資料時，請保留 SITCON Credits 的脈絡。
- 使用 site profile 資料時，請保留原活動網站與 SITCON Credits 的歷史活動脈絡。
- `public_email` 只代表 contributor 願意在 SITCON Credits 公開頁面顯示該 email，不代表同意被加入郵件名單、行銷名單、徵才名單或其他無關資料庫。
- 不應把 profile 資料與未公開、未經本人同意或內部來源取得的個人資訊合併後再發布。
- 不應把 profile 內容用於排名、評分、徵信、招募篩選或其他脫離社群感謝脈絡的用途。
- 若 contributor 要求移除或修改 profile 資料，請以最新 repository 內容為準，並尊重其 opt-in 邊界。

## 與 SITCON Credits 的關係

本 repo 保存 contributor opt-in 的公開 profile 資料，以及維護者整理的活動網站來源顯示資料。歷史活動紀錄、身份連結、來源 URL 與 canonical data 仍由 [`sitcon-tw/credits`](https://github.com/sitcon-tw/credits) 維護。

某個 GitHub username 有 profile 檔案，不代表任何歷史 appearance 已經自動連到這個 profile。某個 appearance 使用 `site:<source_person_id>`，也只代表它暫時連到同一活動網站來源中的顯示資料。歷史 appearance 是否連到某個 GitHub username，仍以 `sitcon-tw/credits` canonical Google Sheet 中經維護者審核的 `appearances.github_username` 為準。
