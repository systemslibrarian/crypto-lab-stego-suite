# crypto-lab-stego-suite

[![CI](https://github.com/systemslibrarian/crypto-lab-stego-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/systemslibrarian/crypto-lab-stego-suite/actions/workflows/ci.yml)

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

**Bring your own image.** Upload any photo as the cover medium (it feeds every exhibit), embed a message, download the exact stego PNG, then re-upload it to extract — a full round-trip on real imagery. Each embed reports fidelity metrics (PSNR, peak per-channel change) and a live capacity meter shows how much of the carrier your payload consumes.

### Steganalysis, stated correctly

The chi-squared exhibit reports the Westfeld–Pfitzmann **probability of embedding** — `Q(dof/2, χ²/2)`, where ≈1 means the carrier looks LSB-embedded and ≈0 means it looks natural. It also surfaces the test's real blind spot: applied to a whole image it only fires reliably near full embedding, so partial and adaptive payloads slip past it. The adaptive exhibit quantifies *why* adaptive embedding is stealthier (mean texture at embedding sites, fraction of bits landing in smooth regions) rather than overclaiming a difference the crude global test cannot actually see.

## 4. How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-stego-suite
cd crypto-lab-stego-suite
npm install
npm run dev        # start the dev server
npm test           # run the unit + DOM integration suite (Vitest)
npm run check      # typecheck + test + production build (what CI runs)
```

## 5. Engineering

The steganographic, cryptographic, DCT, and steganalysis core lives in dependency-free, fully unit-tested modules under [`src/lib`](src/lib); `src/main.ts` is the DOM/canvas layer. The Vitest suite covers bit/packet round-trips, AES-256-GCM, LSB and DCT embed/extract, the incomplete-gamma p-function against closed forms, distortion metrics, and a jsdom integration smoke test that drives every control. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs typecheck + tests + build on every push and pull request.

## 6. Part of the Crypto-Lab Suite

Part of [crypto-lab](https://systemslibrarian.github.io/crypto-lab/) — browser-based cryptography demos spanning 2,500 years of cryptographic history to NIST FIPS 2024 post-quantum standards.

> So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31