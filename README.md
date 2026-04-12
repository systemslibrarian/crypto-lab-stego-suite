# crypto-lab-stego-suite

## 1. What It Is

Stego Suite demonstrates three steganographic techniques — LSB (Least Significant Bit) substitution, F5-inspired DCT-domain embedding, and WOW-inspired adaptive steganography — alongside their corresponding steganalysis attacks. Steganography hides the existence of a message rather than its content, making it fundamentally different from encryption. The demo covers the complete hiding-and-detection cycle: embed a payload, attempt detection with a chi-squared test, compare sequential vs adaptive embedding strategies, and examine real-world deployments from printer tracking dots to malware covert channels.

## 2. When to Use It

- ✅ Digital watermarking for copyright protection (robust embedding)
- ✅ Covert communication where the existence of a message must be hidden
- ✅ Combined with encryption: encrypt first, then hide (strongest model)
- ✅ Network covert channels (timing-based or header-based)
- ❌ LSB steganography for any adversarial context — chi-squared test detects it trivially and has since 1999
- ❌ Steganography alone without encryption — if detected, content is exposed
- ❌ JPEG LSB embedding — JPEG compression destroys LSB modifications (use DCT-domain tools for JPEG)
- ❌ Smooth image regions — always embed in textured areas

## 3. Live Demo

Link: https://systemslibrarian.github.io/crypto-lab-stego-suite/

Six exhibits: steganography vs cryptography orientation, LSB substitution with pixel-level visualization and optional AES encryption, chi-squared steganalysis detecting LSB embedding (real statistical test), F5-inspired DCT-domain embedding with 8×8 block transform visualization, WOW-inspired adaptive embedding using texture cost maps, and real-world cases including printer tracking dots, digital watermarking, malware C2 channels, and the current ML steganalysis arms race.

## 4. How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-stego-suite
cd crypto-lab-stego-suite
npm install
npm run dev
```

## 5. Part of the Crypto-Lab Suite

Part of [crypto-lab](https://systemslibrarian.github.io/crypto-lab/) — browser-based cryptography demos spanning 2,500 years of cryptographic history to NIST FIPS 2024 post-quantum standards.

> So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31