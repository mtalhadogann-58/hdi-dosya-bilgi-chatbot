# HDI Dosya Bilgi Chatbot PoC

Canlı OpenAI Responses API kullanan, HDI çağrı merkezi / dosya bilgi use case'i için hazırlanmış Next.js PoC.

## Vercel değişkenleri

Zorunlu:
- `OPENAI_API_KEY`

Opsiyonel:
- `OPENAI_MODEL` (varsayılan: `gpt-5.6-terra`)

## Demo doğrulama verileri

- Sigortalı: TCKN `11111111111` + Dosya No `294551`
- Mağdur: TCKN `22222222222` + Dosya No `294551`
- Servis: Servis Kodu `3840` + Dosya No `294551`
- Acente: Partaj No `7693` + Dosya No `294551`

Veriler gerçek kişi verisi değildir. Paylaşılan response alan yapıları korunarak maskelenmiş/sentetikleştirilmiştir.

## Mimari not

- Selamlaşma / serbest konuşma: LLM
- Niyet + rol + alan çıkarımı: LLM
- KVKK/rol doğrulama kararı: deterministik backend kuralı
- Hassas context'in modele verilmesi: yalnızca doğrulama başarılıysa
- Task etiketleri: model üretir, operasyon görünümünde izlenir
- Bu PoC'de gerçek HDI servis çağrıları yoktur; mock response kullanılır.
