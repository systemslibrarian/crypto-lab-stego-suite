# crypto-lab-stego-suite

## What It Is

Stego Suite demonstrates three steganographic techniques — LSB (Least Significant Bit) substitution, F5-inspired DCT-domain embedding, and WOW-inspired adaptive steganography — alongside their corresponding steganalysis attacks. Steganography hides the existence of a message rather than its content, making it fundamentally different from encryption. The demo covers the complete hiding-and-detection cycle: embed a payload, attempt detection with a chi-squared test, compare sequential vs adaptive embedding strategies, and examine real-world deployments from printer tracking dots to malware covert channels.

## When to Use It

- ✅ Digital watermarking for copyright protection (robust embedding)
- ✅ Covert communication where the existence of a message must be hidden
- ✅ Combined with encryption: encrypt first, then hide (strongest model)
- ✅ Network covert channels (timing-based or header-based)
- ❌ LSB steganography for any adversarial context — chi-squared test detects it trivially and has since 1999
- ❌ Steganography alone without encryption — if detected, content is exposed
- ❌ JPEG LSB embedding — JPEG compression destroys LSB modifications (use DCT-domain tools for JPEG)
- ❌ Smooth image regions — always embed in textured areas
- ❌ As a production steganography or anti-forensics tool — this is a teaching demo of hiding-and-detection techniques, not a hardened covert-channel implementation

## Live Demo

**[systemslibrarian.github.io/crypto-lab-stego-suite](https://systemslibrarian.github.io/crypto-lab-stego-suite/)**

Six exhibits cover steganography-vs-cryptography orientation, LSB substitution with pixel-level visualization and optional AES encryption, a real chi-squared steganalysis test detecting LSB embedding, F5-inspired DCT-domain embedding with 8×8 block transform visualization, WOW-inspired adaptive embedding using texture cost maps, and real-world cases from printer tracking dots to malware C2 channels. **Bring your own image:** upload any photo as the cover, embed a message, download the exact stego PNG, then re-upload to extract — a full round-trip on real imagery, with PSNR/fidelity metrics, a peak per-channel change readout, and a live capacity meter.

## What Can Go Wrong

- **LSB is trivially detectable** — the chi-squared test has reliably flagged sequential LSB embedding since 1999; LSB offers no security in any adversarial setting.
- **JPEG compression destroys LSB** — re-encoding a JPEG wipes LSB modifications, so spatial LSB is useless for JPEG carriers (use DCT-domain methods instead).
- **Embedding in smooth regions** — flat areas make statistical anomalies obvious; adaptive schemes concentrate changes in textured regions for exactly this reason.
- **Stego without encryption** — steganography hides existence, not content; once a payload is detected, an unencrypted message is fully exposed.
- **Capacity vs detectability** — the more of the carrier a payload fills, the easier detection becomes; near-full embedding is precisely where even crude global tests start firing.

## Real-World Usage

- **Printer tracking dots** — many color laser printers embed near-invisible yellow microdot patterns encoding serial number and timestamp.
- **Digital watermarking** — robust embedding marks images, audio, and video for copyright and provenance tracking.
- **Malware covert channels** — real-world malware has hidden command-and-control data and payloads inside images and other media.
- **Network covert channels** — timing- and header-based steganography smuggles data through traffic that looks ordinary.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-stego-suite
cd crypto-lab-stego-suite
npm install
npm run dev
```

## Related Demos

- [crypto-lab-j-uniward](https://systemslibrarian.github.io/crypto-lab-j-uniward/) — J-UNIWARD adaptive DCT-domain embedding, the modern successor to the techniques shown here.
- [crypto-lab-shadow-vault](https://systemslibrarian.github.io/crypto-lab-shadow-vault/) — deniable encryption, the cryptographic cousin of hiding a message's existence.
- [crypto-lab-aes-modes](https://systemslibrarian.github.io/crypto-lab-aes-modes/) — AES authenticated encryption for the "encrypt first, then hide" model.
- [crypto-lab-oram-vault](https://systemslibrarian.github.io/crypto-lab-oram-vault/) — Path ORAM, hiding access patterns rather than message content.
- [crypto-lab-iron-letter](https://systemslibrarian.github.io/crypto-lab-iron-letter/) — authenticated public-key encryption to seal a payload before embedding it.

## Steganalysis, stated correctly

The chi-squared exhibit reports the Westfeld–Pfitzmann **probability of embedding** — `Q(dof/2, χ²/2)`, where ≈1 means the carrier looks LSB-embedded and ≈0 means it looks natural. It also surfaces the test's real blind spot: applied to a whole image it only fires reliably near full embedding, so partial and adaptive payloads slip past it. The adaptive exhibit quantifies *why* adaptive embedding is stealthier (mean texture at embedding sites, fraction of bits landing in smooth regions) rather than overclaiming a difference the crude global test cannot actually see.

## Engineering

The steganographic, cryptographic, DCT, and steganalysis core lives in dependency-free, fully unit-tested modules under [`src/lib`](src/lib); `src/main.ts` is the DOM/canvas layer. The Vitest suite covers bit/packet round-trips, AES-256-GCM, LSB and DCT embed/extract, the incomplete-gamma p-function against closed forms, distortion metrics, and a jsdom integration smoke test that drives every control. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs typecheck + tests + build on every push and pull request.

Additional npm scripts:

```bash
npm test           # run the unit + DOM integration suite (Vitest)
npm run check      # typecheck + test + production build (what CI runs)
```

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
