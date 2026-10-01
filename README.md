# HDI Dosya Bilgi Chatbot PoC V4

## Mimari prensip
**AI konuşmayı yönetir. Sistem gerçeği doğrular. Kural motoru sınırı çizer.**

V4, V3'teki lineer state-machine yaklaşımını kaldırır.

### AI'nın görevi
- Kullanıcı niyetini ve diyalog hareketini anlamak
- Düzeltme / geri dönüş / rol değişimi / konu değişimini anlamak
- Çoklu intent'i ayırmak
- Doğrulama için doğal sırayı yönetmek
- Tool sonuçlarını müşterinin anlayacağı dile çevirmek
- Task etiketlerini önermek

### Deterministik katmanın görevi
- TCKN/VKN/servis/partaj/dosya/poliçe eşleşmesi
- KVKK ve paylaşım kontrolü
- Servis verisinin gerçekliği
- Doğrulama policy'si
- Taxonomy doğrulaması
- Dependency invalidation / audit state

## Dosyalar
- `app/page.js` — sohbet UI
- `app/api/chat/route.js` — AI orchestrator
- `lib/prompts.js` — planner + response prompt
- `lib/stateEngine.js` — conversation state / dependency logic
- `lib/tools.js` — mock servis araçları
- `lib/policy.js` — KVKK / doğrulama kuralları
- `lib/taxonomy.js` — task taxonomy validation
- `lib/mockData.js` — maskeli response örneği

## Vercel
Environment Variables:
- `OPENAI_API_KEY` zorunlu
- `OPENAI_MODEL` opsiyonel (varsayılan `gpt-6-luna`)

## Test örnekleri
1. `Dosyam ne durumda?`
2. Rol butonundan `Sigortalı`
3. `11111111111`
4. Yanlış dosya: `329123`
5. `Pardon TC'yi yanlış vermişim`
6. Yeni TCKN gir
7. `Dosya numaram yok, poliçe ile devam edebilir miyiz?`
8. `Ödemeyi boşver, eksperi soruyorum`
9. `Ben aslında acenteyim`
10. `Niye TCKN istiyorsun?`

## Production notu
Bu PoC'deki `tools.js` mock servisler kullanır. Canlıda yalnızca bu fonksiyonların içi HDI servislerine bağlanmalıdır; AI orkestrasyon katmanı değişmek zorunda değildir.
