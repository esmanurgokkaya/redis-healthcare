# Redis Healthcare

MongoDB üzerinde tutulan hasta kayıtları için Redis cache'lemesi ve rate limiting kullanan basit bir Express API.

## Özellikler

- **Hasta kayıtları (CRUD)**: MongoDB + Mongoose ile hasta oluşturma, getirme ve güncelleme
- **Cache**: `GET /patient/:id` istekleri Redis'te 60 saniye cache'lenir (cache hit/miss loglanır)
- **Cache invalidation**: Hasta güncellendiğinde (`PUT`) ilgili cache kaydı silinir
- **Görüntülenme sayacı**: Her hasta görüntülemesi Redis'te sayılır (`views:<id>`)
- **Rate limiting**: IP başına 30 saniyede en fazla 5 istek (`GET /patient/:id` endpoint'inde)

## Teknolojiler

- Node.js / Express 5
- MongoDB (Mongoose 9)
- Redis 6

## Kurulum

```bash
npm install
```

MongoDB (`mongodb://localhost:27017/healthcareDB`) ve Redis (`redis://localhost:6379`) sunucularının çalışıyor olması gerekir.

## Çalıştırma

```bash
node server.js
```

Sunucu `http://localhost:3000` üzerinde başlar.

## API Uçları

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/patient` | Yeni hasta oluşturur |
| GET | `/patient/:id` | Hasta bilgisini getirir (cache'li, rate limitli) |
| PUT | `/patient/:id` | Hasta bilgisini günceller (cache invalidation) |
| GET | `/patient/:id/views` | Hastanın görüntülenme sayısını döner |

## Hasta Modeli

```js
{
  name: String,
  age: Number,
  diagnosis: String,
  doctor: {
    name: String,
    specialty: String
  }
}
```

## Test Sonuçları

`GET /patient/:id` uç noktasına art arda istek atılarak cache ve rate limiter davranışı gözlemlendi:

- **Cache HIT**: Ortalama ~0.5–0.8ms yanıt süresi (Redis'ten okuma)
- **Cache MISS**: ~7.5ms yanıt süresi (MongoDB sorgusu + Redis'e yazma), yaklaşık **10 kat** daha yavaş
- **Görüntülenme sayacı**: Her istekte `views:<id>` doğru şekilde artıyor
- **Rate limiting**: Aynı IP'den 30 saniye içinde 5. istekten sonra gelen istekler engelleniyor; 30 saniyelik pencere dolunca sayaç `1`'den tekrar başlıyor ve cache tekrar `MISS` oluyor (cache 60 saniyede bir kere expire olduğu için ara sıra HIT'e dönüyor)

Örnek log:

```
CACHE HIT
Toplam süre: 0.663ms
IP: ::1 - İstek sayısı: 2
...
IP: ::1 - İstek sayısı: 6   # rate limit aşıldı, istek reddedildi
IP: ::1 - İstek sayısı: 7   # rate limit aşıldı, istek reddedildi
IP: ::1 - İstek sayısı: 1   # 30sn pencere sıfırlandı
CACHE MISS
Toplam süre: 7.467ms
```

Sonuç: Redis cache, veritabanı sorgu süresini önemli ölçüde azaltıyor; rate limiter beklenen eşikte (5 istek / 30 sn) devreye giriyor.
