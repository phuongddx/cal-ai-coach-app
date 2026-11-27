# Triển khai CoachCal API lên VPS (docker compose)

Tài liệu này dành cho Phương tự chạy. Không bot nào đã deploy lên server thật. Bộ file nằm ở
`apps/api/deploy/`: `docker-compose.yml` (PostgreSQL 17, bước migrate chạy một lần, API, Caddy),
`Caddyfile`, `initdb/01-roles.sh`, `backup.sh`; image build từ `apps/api/Dockerfile`; danh sách biến
môi trường ở `apps/api/.env.example` (chỉ có tên và ý nghĩa, không có giá trị).

## Cái gì đã chạy thử, cái gì chưa

| Bước | Trạng thái |
|---|---|
| Build image, `docker compose up` với Caddy HTTPS trên `localhost`, migrate một lần, `/health`, đăng nhập bằng mã e-mail (log), backup, verify, restore đè lên DB đang chạy, quyền của role giữ nguyên | ĐÃ chạy trên máy Mac của bot (Docker Desktop), đã dọn container, volume và image sau khi xong |
| Sync, scan, webhook, xoá tài khoản, mọi đường đăng nhập | ĐÃ có test tự động (Jest, SQL thật, PostgreSQL 17); smoke qua `scripts/rn/smoke-auth.sh` và `smoke-scan.sh` |
| VPS thật, DNS, chứng chỉ Let's Encrypt thật, firewall | CHƯA chạy |
| Apple (đổi authorization code, revoke token), Google (đổi code lấy ID token) | CHƯA gọi Apple/Google thật; test dùng khoá và JWKS giả |
| Gửi mail thật qua Resend | CHƯA chạy (test dùng sender ghi log) |
| RevenueCat gửi webhook thật | CHƯA chạy |
| Cron backup trên VPS, restore trên máy khác | CHƯA chạy |
| Giới hạn tốc độ (rate limit) | Nằm trong bộ nhớ, chỉ đúng khi chạy một bản API (compose chạy đúng một) |

## 1. VPS và DNS

1. Thuê VPS Ubuntu 24.04 (hoặc Debian 12) có 2 GB RAM, 20 GB ổ đĩa trở lên. Image API nặng khoảng 721 MB.
2. Cài Docker Engine và plugin compose theo hướng dẫn chính thức:
   https://docs.docker.com/engine/install/ubuntu/ (kiểm tra bằng `docker compose version`).
3. Tạo bản ghi DNS loại A (và AAAA nếu có IPv6) cho tên miền API, ví dụ `api.example.com`, trỏ về IP
   của VPS. Chờ DNS lan truyền (`dig +short api.example.com` ra đúng IP) trước khi chạy Caddy, nếu
   không Let's Encrypt sẽ từ chối cấp chứng chỉ.

## 2. Firewall: chỉ mở 22, 80, 443

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Lưu ý: Docker tự ghi luật iptables cho cổng nó publish và có thể vượt qua ufw. Trong compose chỉ
Caddy publish cổng (80, 443); PostgreSQL và API không publish cổng nào ra ngoài. Giữ nguyên như vậy.
Nên tắt đăng nhập SSH bằng mật khẩu, chỉ dùng khoá.

## 3. Lấy mã nguồn

```sh
sudo mkdir -p /srv/coachcal && sudo chown "$USER" /srv/coachcal
git clone https://github.com/<tổ chức>/<repo>.git /srv/coachcal
cd /srv/coachcal/apps/api/deploy
```

Repo là public: không bao giờ commit file `.env` hay khoá `.p8`. `apps/api/deploy/.gitignore` đã bỏ qua
`.env` và `backups/`.

## 4. Hai role PostgreSQL

Không cần tạo tay. Lần đầu volume `pgdata` còn trống, `initdb/01-roles.sh` tạo:

- `coachcal_owner`: sở hữu bảng, chỉ dùng cho bước migrate và backup. Mật khẩu `COACHCAL_OWNER_PASSWORD`.
- `coachcal_api`: là role API dùng khi chạy. Không có quyền đọc hay ghi bảng, chỉ có EXECUTE trên các hàm SQL
  `SECURITY DEFINER`. Mật khẩu `COACHCAL_API_PASSWORD`.
- Database `coachcal` do `coachcal_owner` sở hữu.

Script chỉ chạy một lần, khi data directory còn rỗng. Đổi mật khẩu sau này phải dùng `ALTER ROLE`
(đổi biến môi trường không đủ).

## 5. File biến môi trường

Tạo `apps/api/deploy/.env` (quyền 600). Sinh bí mật bằng `openssl rand -hex 32`. Mật khẩu role chỉ dùng chữ
và số (chúng đi vào URL kết nối), ví dụ `openssl rand -hex 24`.

```sh
cd /srv/coachcal/apps/api/deploy
umask 077
touch .env
chmod 600 .env
$EDITOR .env
```

### Danh sách bí mật và cấu hình đầy đủ

Bắt buộc để compose chạy (thiếu là `docker compose` dừng ngay và nói thiếu biến nào):

| Biến | Là gì | Cách có |
|---|---|---|
| `DOMAIN` | Tên miền API, Caddy xin chứng chỉ cho tên này | ví dụ `api.example.com` |
| `PUBLIC_BASE_URL` | `https://` + `DOMAIN`, không có dấu `/` cuối | ví dụ `https://api.example.com` |
| `POSTGRES_PASSWORD` | Mật khẩu superuser PostgreSQL | sinh ngẫu nhiên |
| `COACHCAL_OWNER_PASSWORD` | Mật khẩu role `coachcal_owner` | sinh ngẫu nhiên, chỉ chữ và số |
| `COACHCAL_API_PASSWORD` | Mật khẩu role `coachcal_api` | sinh ngẫu nhiên, chỉ chữ và số |
| `AUTH_JWT_SECRET` | Ký access token (HS256), từ 32 ký tự. Đổi là mọi người bị đăng xuất | `openssl rand -hex 32` |
| `AUTH_ENCRYPTION_KEY` | Khoá gốc mã hoá refresh token của Apple, khoá mã OTP và state Google. Mất hoặc đổi là token Apple đã lưu không đọc được | `openssl rand -hex 32` |
| `RC_WEBHOOK_SIGNING_SECRET` | Bí mật RevenueCat dùng ký webhook | sinh ngẫu nhiên, dán cùng giá trị vào RevenueCat |
| `OTP_SENDER` | `resend` trên production. `log` chỉ để thử cục bộ (mã in ra log) | `resend` |

Cần khi `OTP_SENDER=resend`: `RESEND_API_KEY` (khoá Resend), `OTP_FROM` (địa chỉ gửi trên domain đã xác minh,
ví dụ `CoachCal <login@example.com>`).

Cần cho đăng nhập Apple (thiếu bất kỳ biến nào thì route trả 503 và nêu tên biến thiếu): `APPLE_BUNDLE_ID`,
`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` (xem mục 10).

Cần cho đăng nhập Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (xem mục 11).

Cần cho scan: `VLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `USDA_FDC_API_KEY`; tuỳ chọn `GEMINI_MODEL`,
`GEMINI_ESCALATION_MODEL`, `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, `OFF_USER_AGENT`.

Không đặt trên production: `AUTH_DEV_TOKENS` (token dev), `VLM_PROVIDER=fixture`, `OTP_SENDER=log`.
Biến chỉ có ở `.env.example`, đọc ý nghĩa từng dòng ở đó.

Tuỳ chọn cho compose: `POSTGRES_USER`, `HTTP_PORT`, `HTTPS_PORT`, `COMPOSE_PROJECT_NAME`, `BACKUP_DIR`,
`BACKUP_KEEP_DAYS`.

## 6. Khởi động stack

```sh
cd /srv/coachcal/apps/api/deploy
docker compose config --quiet        # kiểm tra file .env đủ biến
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f migrate api   # Ctrl+C để thoát
```

Thứ tự: PostgreSQL khoẻ, rồi dịch vụ `migrate` chạy một lần (dùng role owner, xong thì thoát với mã 0), rồi `api`
(chỉ có mật khẩu role `coachcal_api`), rồi Caddy. Lần đầu Caddy có thể mất vài chục giây để lấy chứng chỉ.

## 7. Migrate

Đã nằm trong bước 6 (dịch vụ `migrate`, chạy `src/migrate.ts`: áp dụng từng file trong `apps/api/migrations/` đúng một lần,
ghi vào bảng `schema_migrations`). Chạy lại khi cập nhật:

```sh
docker compose run --rm migrate
```

## 8. Kiểm tra /health và smoke từ laptop

```sh
curl -fsS https://api.example.com/health      # {"ok":true,"service":"coachcal-api"}
```

Smoke đăng nhập từ laptop: script `scripts/rn/smoke-auth.sh` đọc mã từ log local nên chỉ dùng được khi
`OTP_SENDER=log`, KHÔNG dùng với production. Kiểm tra tay trên production:

```sh
curl -sS -X POST https://api.example.com/v1/auth/otp/request \
  -H 'content-type: application/json' --data '{"email":"ban@example.com"}'   # {"ok":true}, mail về hộp thư
curl -sS -X POST https://api.example.com/v1/auth/otp/verify \
  -H 'content-type: application/json' --data '{"email":"ban@example.com","code":"<mã 6 số>"}'
# trả {"user":...,"tokens":{"accessToken","refreshToken","expiresAt"}}
curl -sS -X POST https://api.example.com/v1/sync/pull \
  -H "authorization: Bearer <accessToken>" -H 'content-type: application/json' --data '{"cursor":0}'
```

Sau khi thử xong, xoá tài khoản thử bằng `DELETE /v1/account` với token đó.

## 9. Backup và thử restore

```sh
cd /srv/coachcal/apps/api/deploy
./backup.sh backup                          # ghi backups/coachcal-<thời gian>.dump, quyền 600, giữ 14 ngày
./backup.sh verify backups/coachcal-<...>.dump    # restore vào DB tạm, đếm dòng, rồi xoá DB tạm
```

Cron hằng đêm (user chạy docker): `10 3 * * * /srv/coachcal/apps/api/deploy/backup.sh backup >> /var/log/coachcal-backup.log 2>&1`.

Restore đè lên DB đang chạy (khi có sự cố):

```sh
docker compose stop api caddy
CONFIRM=yes ./backup.sh restore backups/coachcal-<...>.dump coachcal
docker compose start api caddy
```

Quan trọng: file backup nằm cùng ổ với DB. Copy chúng sang nơi khác (object storage, máy khác), nếu không mất VPS là mất cả hai. Làm
bài thử restore (`verify`) trước khi mở cho người dùng, rồi lặp lại định kỳ. Backup không chứa `.env`: lưu `.env` và khoá `.p8` ở
trình quản lý mật khẩu riêng.

## 10. Apple: Sign in with Apple

API xác minh identity token của app và đổi authorization code lấy refresh token (để revoke khi xoá tài khoản, theo yêu cầu App Store).
Thiết kế dùng App ID (bundle ID) làm `client_id`, đúng với luồng native của app iOS, nên KHÔNG cần Services ID và return URL
(chỉ cần khi có luồng web).

1. developer.apple.com, Certificates, Identifiers & Profiles, Identifiers: bật capability Sign in with Apple cho App ID của app.
2. Keys, tạo key mới, bật Sign in with Apple, chọn App ID chính. Tải file `AuthKey_<KEYID>.p8` (chỉ tải được một lần).
3. Ghi lại Key ID (10 ký tự trên trang key) và Team ID (góc phải trên, hoặc Membership).
4. Đặt file vào `apps/api/deploy/secrets/` (thư mục được git bỏ qua, quyền 600). Compose mount nó ở `/run/secrets`.
5. Trong `.env`: `APPLE_BUNDLE_ID=<bundle id>`, `APPLE_TEAM_ID=<team id>`, `APPLE_KEY_ID=<key id>`,
   `APPLE_PRIVATE_KEY_PATH=/run/secrets/AuthKey_<KEYID>.p8`.
6. `docker compose up -d api`, rồi thử đăng nhập Apple từ build thật trên thiết bị (chưa ai thử).

## 11. Google: Sign in with Google

Luồng: app mở `GET /v1/auth/google/start` trong trình duyệt hệ thống, Google gọi lại `GET /v1/auth/google/callback`, API chuyển
trình duyệt về `coachcal://auth/google?code=<mã dùng một lần>`, app đổi mã đó qua `POST /v1/auth/google/exchange`.

1. console.cloud.google.com, chọn hoặc tạo project, APIs & Services, OAuth consent screen: cấu hình, thêm scope `openid` và `email`.
2. Credentials, Create credentials, OAuth client ID, loại Web application.
3. Authorized redirect URIs: thêm chính xác `https://api.example.com/v1/auth/google/callback` (= `PUBLIC_BASE_URL` + `/v1/auth/google/callback`).
4. Lấy Client ID và Client secret, đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` trong `.env`.
5. Nếu consent screen còn ở chế độ Testing thì chỉ tài khoản test đăng nhập được; chuyển sang In production khi sẵn sàng.

## 12. Gửi mail mã đăng nhập (Resend)

1. resend.com: thêm domain gửi mail, thêm bản ghi DNS (SPF, DKIM) Resend yêu cầu, chờ trạng thái Verified.
2. Tạo API key quyền gửi mail. Đặt `RESEND_API_KEY`, `OTP_FROM` (địa chỉ trên domain đã xác minh) và `OTP_SENDER=resend`.
3. Khi mail không gửi được, API trả 503 `UPSTREAM_ERROR` cho `POST /v1/auth/otp/request`; xem `docker compose logs api`.

## 13. RevenueCat webhook

Trong dashboard RevenueCat, Integrations, Webhooks: URL `https://api.example.com/webhooks/revenuecat`, và đặt bí mật ký trùng
với `RC_WEBHOOK_SIGNING_SECRET`. API kiểm tra header `X-RevenueCat-Webhook-Signature` (`t=<giây>,v1=<hex>`,
HMAC-SHA256 trên `t.` + body thô, lệch quá 300 giây bị từ chối). Event dùng `app_user_id` là id người dùng của API.

## 14. Cập nhật phiên bản

```sh
cd /srv/coachcal
./apps/api/deploy/backup.sh backup          # luôn backup trước
git fetch origin && git merge --ff-only origin/main   # hoặc git checkout <tag>
cd apps/api/deploy
docker compose build
docker compose run --rm migrate
docker compose up -d
curl -fsS https://api.example.com/health
```

## 15. Rollback

Rollback code: ghi lại commit đang chạy (`git rev-parse HEAD`) trước khi cập nhật, khi lỗi:

```sh
git checkout <commit-cũ>
cd apps/api/deploy && docker compose build && docker compose up -d api
```

Migrate chỉ tiến lên, không có migration lùi. Nếu bản mới đã áp dụng migration làm bản cũ lỗi, restore dump
trước khi cập nhật (mục 9, `CONFIRM=yes ./backup.sh restore ... coachcal`) rồi mới chạy lại image cũ. Vì vậy
luôn backup ngay trước khi migrate.

## 16. Xử lý sự cố nhanh

- Caddy không lấy được chứng chỉ: DNS chưa trỏ đúng, hoặc cổng 80/443 bị chặn. `docker compose logs caddy`.
- `docker compose` báo thiếu biến: đọc tên biến trong thông báo, thêm vào `.env`.
- Đăng nhập Apple hoặc Google trả 503: thông báo nêu tên biến chưa đặt.
- Nhiều người bị 429: giới hạn tốc độ theo IP và e-mail, `Retry-After: 900`; kiểm tra Caddy có chuyển đúng IP thật
  (API đọc phần tử cuối của `X-Forwarded-For`).
- Đã xoá nhầm volume `pgdata`: restore từ dump (mục 9). Dữ liệu chỉ tồn tại trong volume đó và trong các file dump.
