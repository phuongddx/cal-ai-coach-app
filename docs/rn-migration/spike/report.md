# Spike React Native + Expo cho CoachCal: báo cáo

Ngày 27/11/2026. Người làm: CoachCal (spec, plan, merge, đo, báo cáo) và Worker-S1, Worker-S2,
Worker-G1, Worker-G2 (code và chạy). Nhánh `spike/rn-expo`, 34 commit, chưa push, không merge vào
`main`, không mở PR. Toàn bộ nằm trong `rn-spike/`; không sửa `native/`, `web/`, `supabase/`.

Mọi kết quả "pass" dưới đây là **pass trên simulator** (iPhone 17 Pro, iOS 26.4, Xcode 27.1).
Chưa có gì chạy trên máy thật. Android không được build vì máy không có Android SDK.

## 1. Kết luận: go có điều kiện

**Cả 4 mục đều chạy mà không cần viết một dòng Swift hay Kotlin nào.** Rủi ro kỹ thuật phía iOS mà
báo cáo RN trước đó chưa kiểm được thì đã bỏ: tab bar và Liquid Glass là native thật, widget viết
bằng TypeScript, HealthKit đi qua thư viện, sync tự viết chạy đúng. Hai thứ spike này không trả lời
được là Android và máy thật.

- **Chọn RN + Expo nếu Phương chốt Android trong khoảng 2 quý tới.** Lúc đó một codebase cho cả hai
  nền tảng vẫn là lý do chính, và RN đã rẻ hơn rủi ro hơn Flutter ở đúng hai chỗ khó nhất (glass
  thật, widget bằng TypeScript).
- **Không rewrite nếu iOS vẫn là trọng tâm.** Giữ SwiftUI và làm Ember trên SwiftUI. Một bản
  rewrite ước tính 14–22 tuần chỉ để ngang bằng bản hiện có, trong khi app chưa có user trả tiền.

Trước khi chi ngân sách rewrite cần chạy thêm hai kiểm tra, vì cả hai đều nằm ngoài khả năng của
spike này (mục 5): build Android cho mục 1 và mục 4; chạy 4 mục trên iPhone thật.

Thứ sẽ làm tôi đổi ý:

- Android build của mục 1 hoặc mục 4 lỗi, hoặc widget và sync phải viết native bên Android.
- Trên máy thật, glass hoặc widget nhìn khác rõ so với simulator, hoặc HealthKit từ chối quyền ghi
  kiểu correlation.
- Android không nằm trong kế hoạch 2 quý: khi đó rewrite là chi phí thuần, không cần kiểm thêm.

## 2. Bảng 4 mục

Thư mục gốc của bằng chứng: `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-expo/rn-spike/`.
`npm test` tại `rn-spike/`: 4 workspace, 119 test pass (api 11, mobile 76, api-contract 22, core 10).
`npm run typecheck`: sạch.

| # | Mục | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Tab bar native có Liquid Glass + màn Ember | **Pass** (simulator) | `evidence/item1/ember-light.png`, `ember-dark.png`, `ember-*-scrolled.png`, `side-by-side-swiftui-vs-rn.png`. Tab bar là thanh glass nổi của iOS 26, thu nhỏ còn một nút tròn khi cuộn xuống; `GlassView` làm mờ nội dung cuộn phía sau; `ui-rounded` và SF Symbols đều render. Không có Swift. Khác thiết kế: nút Scan là nút kính nổi riêng (che kcal của dòng bữa ăn ngay dưới nó), thanh tuần ở light mode tương phản yếu khi cuộn. Chi tiết: `docs/findings/T1-app-shell.md`, `T6-integration.md`. |
| 2 | Home screen widget bằng `expo-widgets`, hiện kcal hôm nay | **Pass** (simulator) | `evidence/item2/home-small-medium-v2-fixed-crop.png` (widget small và medium trên home screen: vòng cam, "946 kcal left", ba thanh macro), `widget-after-add-meal.png`, `widget-after-edit-meal.png`, `widget-after-delete-meal.png`, `widget-after-app-killed.png`, `rollover-before.png` và `rollover-after-t1.png` (đổi ngày). 19 test cho `buildTimeline` và publisher. Không có Swift. |
| 3 | Ghi một bữa ăn vào HealthKit rồi đọc lại | **Pass** (simulator), sau 3 lỗi tích hợp đã sửa | `evidence/item3/request-1-sheet.png` (sheet xin quyền), `health-app-after-save.png` (app Health: 624 kcal, 38 g protein, 70 g carb, 18 g fat lúc 12:40), `health-actions-log.txt` (lưu, lưu lại không trùng `saved:false`, đọc lại 624 kcal, xoá 1 correlation + 4 sample, đọc lại 0). 16 test cho phần mapping. |
| 4 | Sync offline-first với Hono API local | **Pass** (simulator + PostgreSQL 17 local) | `evidence/item4/e2e-app-transcript.txt`: 5 bước chạy từ app, kết thúc `Done — 0 failed check(s)`. Thêm bữa, sửa bữa, xoá bữa khi offline; kill app rồi mở lại còn đủ 3 op trong outbox; có mạng thì push, cursor lên 5; push lại body cũ trả 3 `duplicate`, không thêm row; "máy thứ hai" sửa bữa B thì app pull về. `e2e-transcript.txt` là phần chỉ dùng `curl`. 49 test (contract 22, API 11, engine 16). |

Lệnh đã chạy và đã tự kiểm lại:

- Build native sau khi merge: `› Build Succeeded`, 0 lỗi, 2 cảnh báo (`evidence/build/t6-build-log-tail.txt`).
- `npm test`: 119 pass. `npm run typecheck`: 0 lỗi.
- `bash scripts/start-api.sh` → `bash scripts/e2e-sync.sh` → `bash scripts/start-api.sh stop`: toàn bộ bước `curl` pass, port 5433 và 8787 trống sau khi dừng.
- Sync chạy từ app: `bash scripts/e2e-sync-app.sh`.

## 3. Số đo (toàn bộ trên simulator)

Máy bị tải nền trong lúc đo (load trung bình 7 đến 16 trên 11 nhân, do các app khác), nên các con số
chỉ để biết mức, không nên dùng để so sánh. File gốc: `evidence/measurements/debug.txt`,
`release.txt`. Lệnh: `scripts/measure.sh debug`, `scripts/measure.sh release`.

| Số đo | Debug (dev build) | Release |
|---|---|---|
| Dung lượng `.app` | 192,9 MB | 74,4 MB |
| Dung lượng nén (zip) | 37,6 MB | 20,4 MB |
| Bộ nhớ lúc idle (physical footprint sau 15 giây) | 265,0 MB | 64,8 MB |
| Bộ nhớ lúc idle (RSS) | 445,1 MB | 166,8 MB |
| Cold start, trung vị của 5 lần | 3.390 ms (3.259 đến 3.811) | 1.587 ms (1.472 đến 1.706; lần đầu 3.093) |

Cold start là thời gian từ lúc gọi `xcrun simctl launch` đến lúc React render khung đầu tiên của
màn Ember (file `first-render.txt`). Nó gồm cả overhead của `simctl` và không phải thời gian hiện
frame đầu tiên trên màn hình. Bản Debug còn gồm cả việc tải bundle từ Metro. Dung lượng là của bản
build simulator, không phải bản App Store đã tinh gọn.

Điều làm các con số lệch so với một app production:

- Bản Release ở đây chỉ build một kiến trúc (arm64) cho simulator và vẫn còn kèm `expo-dev-client` và
  `expo-updates` vì hai package nằm trong dependencies; bản production sẽ nhẹ hơn một ít.
- Lần cold start đầu tiên của bản Release (3.093 ms) chạy ngay sau khi cài; bốn lần sau ổn ở 1,47 đến
  1,71 giây.
- Dòng `unavailable` trong hai file đo là lỗi in của script, đã sửa; giá trị footprint ngay phía trên
  là thật.

Chưa đo: app SwiftUI hiện tại (cần một bản build Tuist nằm ngoài phạm vi spike), và mọi số trên máy thật.

## 4. Vấn đề gặp phải

### Phải viết native ở đâu

Không nơi nào. Không có file Swift hay Kotlin nào trong spike. Cấu hình native nằm hết trong
`apps/mobile/app.config.ts` qua config plugin (`expo-widgets`, plugin của thư viện HealthKit,
`expo-dev-client`).

### Thư viện lỗi hoặc phải lách

1. **`@kingstinct/react-native-healthkit` 16.2.0** (mục 3), ba lỗi chỉ hiện khi chạy thật:
   - Xin quyền có kèm correlation type thì native ném `NSInvalidArgumentException`.
   - `authorizationStatusFor(correlationType)` trả "đã cho phép" cả khi chưa xin quyền, nên guard
     cũ cho save chạy khi chưa có quyền.
   - API lưu không nhận UUID; chống lưu trùng phải dựa vào metadata và query trước khi lưu.
2. **Xoá correlation không xoá các sample con** (hành vi HealthKit, quan sát trên simulator; chưa đọc
   tài liệu Apple về điểm này). Phải xoá từng sample theo uuid. Đây là điều phải nhớ khi thiết kế
   đồng bộ xoá bữa ăn sang Health.
3. **`react-native-nitro-modules` 0.37.2** thiếu export `AnyMap` mà types của thư viện HealthKit dùng;
   `skipLibCheck` đang che lỗi này.
4. **Hermes không có `crypto.randomUUID`**. Mọi op sync có id không phải UUID bị server từ chối
   (`z.uuid()`) và bị quarantine; unit test không bắt được vì test chạy trên Node. Đã tự viết UUID v4.
5. **`@expo/ui/swift-ui` cho widget**: `Gauge` bỏ qua `frame` (luôn khoảng 58 pt) và không hiện nhãn
     số; phải chồng số lên và dùng `scaleEffect`. Không chỉnh được độ dày vòng, không vẽ được cung,
     không có màu track, không có `lineLimit`.
6. **`expo-widgets`**: `updateSnapshot` rồi `updateTimeline` sẽ ghi đè nhau, chỉ được gọi
   `updateTimeline` một lần với cả hai mốc. Widget mới thêm hiện placeholder "Open CoachCal Spike"
   cho đến khi app chạy lần đầu.
7. **`NativeTabs.BottomAccessory`** có tồn tại nhưng là capsule full-width, không vừa chỗ nút Scan
   tròn cạnh tab bar trong thiết kế Ember.
8. **Drizzle Kit với `expo-sqlite`** sinh file migration import `.sql`, Metro không bundle được;
   phải inline SQL vào `migrations.ts`.
9. **postgres.js trả jsonb là chuỗi**, PGlite trả object; route pull phải chuẩn hoá.
10. **React Compiler** cache các lời gọi store không tham số, làm UI không cập nhật dù log đã chạy;
    phải đọc store qua `useSyncExternalStore` với snapshot ổn định. Jest không bắt được.

### Docs sai (so với hành vi thật)

- Docs `expo-widgets` nói widget chỉ render được component `@expo/ui/swift-ui`; thực tế native chỉ vẽ
  khoảng 20 kiểu, kiểu khác render trắng hoặc hộp đỏ (S2 đọc source native).
- Docs Expo Router không nhắc `NativeTabs.BottomAccessory` dù nó có trong `expo-router` 58.0.33.
- README của thư viện HealthKit: ví dụ `requestAuthorization` dùng tham số vị trí (thực ra là
  `{toShare, toRead}`); `isHealthDataAvailable` thực ra là hàm đồng bộ.
- Spec của tôi sai ở mục widget (gọi `updateSnapshot` rồi `updateTimeline`); S2 đã sửa.

### Tooling

- CocoaPods crash khi shell không có locale UTF-8.
- Bản patch `expo-widgets` và `@expo/ui` 58.0.30 được publish ngay giữa lúc setup; chỉ lockfile mới
  đáng tin.
- Metro chạy với `CI=1` không tự reload; sửa JS xong phải khởi động lại Metro.
- `@testing-library/react-native` 14 đổi `render` thành async. TypeScript 6 báo lỗi cấu hình `ts-jest` mặc định.
- `axe tap --label` không ăn trên tab bar glass và trong sheet của Health; phải dùng toạ độ.
- Build native lần đầu mất 23 phút và khoảng 6 GB đĩa; máy chỉ còn khoảng 7 GB trống.

## 5. Việc Phương cần tự chạy trên máy thật

1. **Build và chạy trên iPhone thật.** Cần signing (team `K2TYLYAWMK`) và một App ID đăng ký với
   App Groups + HealthKit. Spike dùng bundle id riêng `com.nextlabs.coachcal.rnspike` để không đụng
   app trên App Store; thêm `ios.appleTeamId` vào `apps/mobile/app.config.ts` rồi chạy
   `npx expo run:ios --device` trong `apps/mobile`.
2. **Nhìn Liquid Glass trên máy thật**: độ mờ, khúc xạ, cảm giác tab bar thu nhỏ khi cuộn.
3. **Widget trên home screen thật**: small và medium, chế độ tinted, StandBy, đổi ngày lúc nửa đêm
   thật (trong spike chỉ mô phỏng bằng `rolloverAt` sau 2 phút), ngân sách refresh của WidgetKit.
4. **HealthKit với dữ liệu Health thật**: sheet xin quyền, đơn vị kJ (simulator đang là kcal), và
   hành vi xoá correlation. Quyền đọc không hiển thị với app, nên không phân biệt được "bị từ chối"
   với "không có dữ liệu".
5. **Hiệu năng, bộ nhớ, cold start trên máy thật.**
6. **Android** (sau khi cài Android Studio hoặc SDK): `npx expo run:android` cho mục 1 và mục 4.
   Lưu ý widget Android của `expo-widgets` chỉ là một phần nhỏ, và HealthKit sang Android là Health
   Connect, cần thư viện khác chưa đụng tới trong spike.

## 6. Spike không trả lời được gì

- **Android**: không build, không chạy.
- **Máy thật**: xem mục 5.
- **Backend production**: mới có API sync tối thiểu với token dev, chạy trên PostgreSQL 17 tạm ở
  máy. Chưa có đăng nhập, phân quyền thật, analyze-food, thanh toán.
- **Các phần khác của app**: camera và ước lượng kcal, đăng nhập Apple/Google, IAP, thông báo, Live
  Activity, App Intents (lib còn alpha), watchOS.
- **Ước lượng công**: không thay đổi. Con số 14–22 tuần trong báo cáo RN vẫn là ước tính; spike được
  làm bởi agent trong vài giờ nên không dùng để hiệu chỉnh.

## 7. Đường dẫn và cách chạy lại

Gốc: `/Users/ddphuong/Projects/next-labs/cal-ai-coach-app/.worktrees/rn-expo/rn-spike/`

- Spec: `docs/spec.md`. Plan: `docs/plan.md`. Build recipe: `docs/build-recipe.md`.
- Ghi chép chi tiết từng phần: `docs/findings/T1-app-shell.md`, `T2-widget.md`, `T3-sync.md`,
  `T4-healthkit.md`, `T6-integration.md`.
- Thiết kế Ember và snapshot SwiftUI để so: `docs/reference/`.

```sh
cd rn-spike
npm ci && npm test
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd apps/mobile && npx expo run:ios --device 85024D2F-71DE-43C0-8E11-CE58F4578FC3   # simulator iPhone 17 Pro, iOS 26.4
cd ../.. && scripts/start-api.sh && scripts/e2e-sync-app.sh && scripts/start-api.sh stop   # sync
scripts/measure.sh debug
```

Để trả đĩa lại cho máy, tôi đã xoá DerivedData của app (7,8 GB sau khi build Debug và
Release) và thư mục `apps/mobile/ios/Pods` (1,4 GB). Ô đĩa trống khi kết thúc: khoảng 11 GB.
Build lần tới là build full: `pod install` khoảng 3 phút, biên dịch khoảng 23 phút, cần khoảng
6 GB trống. Hai bản app đã build nằm ở `apps/mobile/build-output/` (không commit); cài lại trên
simulator bằng `xcrun simctl install <udid> <đường-dẫn-.app>`. Simulator hiện đang cài bản Release,
nên app mở thẳng không cần Metro.

## 8. Docs đã đọc để verify

Tôi đọc ngày 26/11/2026:

- https://docs.expo.dev/versions/latest/sdk/widgets
- https://docs.expo.dev/router/advanced/native-tabs
- https://docs.expo.dev/guides/monorepos
- https://docs.expo.dev/develop/unit-testing
- https://docs.expo.dev/versions/latest/sdk/dev-client
- npm registry (phiên bản các package), source và typings của `@expo/ui`, `expo-widgets`,
  `@kingstinct/react-native-healthkit` trong `node_modules`.
- Ba báo cáo của Zed và Worker-S1 đính kèm brief; `design-system.md` và `tokens.css` của Ember;
  `TodayView.swift`, `WidgetSnapshot.swift`, `SyncEnvelope.swift`, `web/core.js`, `web/store.js`.

Worker có đọc thêm source native của `expo-widgets` và `@expo/ui` (danh sách ở `docs/findings/T2-widget.md`)
và khai báo kiểu của thư viện HealthKit (`docs/findings/T4-healthkit.md`). Không ai đọc tài liệu Apple
về xoá correlation; hành vi đó là quan sát trên simulator.
