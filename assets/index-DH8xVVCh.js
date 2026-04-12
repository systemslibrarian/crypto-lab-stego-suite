(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function n(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=n(s);fetch(s.href,i)}})();const V=256,U=37,O=document.getElementById("app");if(!O)throw new Error("App container not found.");O.innerHTML=`
  <main class="shell">
    <header class="hero">
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode">🌙</button>
      <h1>Stego Suite</h1>
      <p class="subtitle">
        The definitive browser-based educational steganography demo: LSB substitution, F5-inspired DCT embedding,
        WOW-inspired adaptive embedding, and real chi-squared steganalysis.
      </p>
      <small>Encryption hides content; steganography hides existence. Strongest model: encrypt first, then hide.</small>
    </header>

    <section class="exhibit" id="exhibit-1">
      <h2>Exhibit 1 — Steganography vs Cryptography: Two Different Goals</h2>
      <p>
        <strong>Cryptography</strong> transforms content into unreadable ciphertext: existence is visible, meaning is hidden.
        <strong>Steganography</strong> hides a payload inside a normal-looking medium: existence is hidden, not just content.
      </p>
      <div class="row">
        <div>
          <h3>Why both are needed</h3>
          <p>Encryption without steganography can still trigger suspicion. Steganography without encryption exposes plaintext if detected.</p>
          <p>Combined workflow: encrypt first, then embed.</p>
        </div>
        <div>
          <h3>Arms race</h3>
          <p>LSB substitution ↔ chi-squared steganalysis (Westfeld & Pfitzmann 1999).</p>
          <p>F5 JPEG steganography ↔ calibration-family attacks (Fridrich et al.).</p>
          <p>Adaptive embedding ↔ ML steganalyzers (for example SRNet-class systems).</p>
        </div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> steganography appears in digital watermarking, covert channels, printer tracking dots,
        and activist/journalist communications where message existence is itself sensitive.
      </div>
      <table>
        <thead>
          <tr><th>Vocabulary</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td>Cover medium</td><td>Original image/audio/video before embedding.</td></tr>
          <tr><td>Stego medium</td><td>Output medium after embedding payload.</td></tr>
          <tr><td>Payload</td><td>Secret bits hidden in the cover.</td></tr>
          <tr><td>Embedding rate</td><td>Payload bits per pixel or coefficient.</td></tr>
          <tr><td>Detectability</td><td>How likely steganalysis identifies stego content.</td></tr>
        </tbody>
      </table>
    </section>

    <section class="exhibit" id="exhibit-2">
      <h2>Exhibit 2 — LSB Substitution: The Simplest Technique</h2>
      <p>
        RGB channels are 8-bit values. Flipping the least-significant bit (LSB) changes a channel by at most 1,
        usually visually imperceptible. This demo embeds 1 bit per channel (3 bits per pixel).
      </p>
      <div class="row">
        <div>
          <label for="lsb-message">Secret message (max 200 chars)</label>
          <textarea id="lsb-message" maxlength="200">Steganography hides the existence of communication.</textarea>
        </div>
        <div>
          <label for="lsb-passphrase">Passphrase for optional AES-256-GCM</label>
          <input id="lsb-passphrase" type="text" placeholder="Optional passphrase" />
          <label><input id="lsb-encrypt" type="checkbox" /> Encrypt before embedding (AES-256-GCM)</label>
        </div>
      </div>
      <div class="controls">
        <button id="lsb-embed" type="button">Embed message</button>
        <button id="lsb-extract" type="button">Extract message</button>
        <button id="lsb-download" type="button">Download stego PNG</button>
      </div>
      <div class="stats" id="lsb-stats"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>Cover image</h4><canvas id="lsb-cover" width="256" height="256"></canvas></div>
        <div class="figure"><h4>Stego image</h4><canvas id="lsb-stego" width="256" height="256"></canvas></div>
        <div class="figure"><h4>20× zoom (cover, 10×10 region)</h4><canvas id="lsb-zoom-cover" width="200" height="200"></canvas></div>
        <div class="figure"><h4>20× zoom (stego, 10×10 region)</h4><canvas id="lsb-zoom-stego" width="200" height="200"></canvas></div>
        <div class="figure"><h4>Histogram before</h4><canvas id="lsb-hist-cover" width="256" height="140"></canvas></div>
        <div class="figure"><h4>Histogram after</h4><canvas id="lsb-hist-stego" width="256" height="140"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> LSB can fool human vision but introduces measurable statistical artifacts.
        Visual similarity is not statistical similarity.
      </div>
    </section>

    <section class="exhibit" id="exhibit-3">
      <h2>Exhibit 3 — Chi-Squared Steganalysis: Detecting LSB</h2>
      <p>
        Westfeld & Pfitzmann (IH 1999) pair-value test over (0,1), (2,3), ..., (254,255). LSB embedding tends to equalize each pair.
        This implementation computes a real chi-squared statistic and p-value with 127 degrees of freedom.
      </p>
      <div class="controls">
        <button id="chi-test-cover" type="button">Test cover image</button>
        <button id="chi-test-stego" type="button">Test stego image</button>
        <button id="chi-run-curve" type="button">Run payload detectability curve</button>
      </div>
      <div class="stats" id="chi-results"></div>
      <div class="figure"><h4>Chi-squared distribution (dof = 127)</h4><canvas id="chi-plot" width="640" height="220"></canvas></div>
      <div id="chi-curve"></div>
      <div class="callout">
        <strong>Why this matters:</strong> the test does not need the original cover image and runs quickly,
        which is why naive LSB has been considered weak for adversarial use since 1999.
      </div>
    </section>

    <section class="exhibit" id="exhibit-4">
      <h2>Exhibit 4 — DCT-Domain Steganography (F5-inspired)</h2>
      <p>
        JPEG steganography works in frequency coefficients. This browser demo performs an educational 8×8 DCT workflow on raw image data.
        <strong>Label:</strong> F5-inspired DCT embedding — not full F5 JPEG re-encoding.
      </p>
      <div class="row">
        <div>
          <label for="dct-message">Secret message for DCT embedding</label>
          <textarea id="dct-message" maxlength="160">Frequency-domain embedding changes AC coefficients by ±1.</textarea>
        </div>
        <div>
          <small>
            Full F5 (Westfeld, IH 2001) embeds in JPEG quantized DCT coefficients with matrix embedding.
            This demo uses non-zero AC coefficient parity in TypeScript for educational visualization.
          </small>
        </div>
      </div>
      <div class="controls">
        <button id="dct-transform" type="button">DCT transform</button>
        <button id="dct-embed" type="button">Embed in DCT</button>
        <button id="dct-inverse" type="button">Inverse DCT</button>
        <button id="dct-extract" type="button">Extract message</button>
      </div>
      <div class="stats" id="dct-stats"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>DCT heatmap before</h4><canvas id="dct-before" width="240" height="240"></canvas></div>
        <div class="figure"><h4>DCT heatmap after (modified highlighted)</h4><canvas id="dct-after" width="240" height="240"></canvas></div>
        <div class="figure"><h4>Spatial image after inverse DCT</h4><canvas id="dct-image" width="256" height="256"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> DCT-domain hiding is operationally important because JPEG dominates web imagery.
        Frequency-domain changes behave differently from simple pixel LSB edits.
      </div>
    </section>

    <section class="exhibit" id="exhibit-5">
      <h2>Exhibit 5 — Adaptive Steganography (WOW-inspired)</h2>
      <p>
        Educational simplification inspired by WOW (Holub & Fridrich, WIFS 2012): compute a texture map using Sobel gradients,
        then embed first in low-cost (high-texture) locations and avoid smooth regions.
      </p>
      <div class="row">
        <div>
          <label for="adapt-message">Adaptive payload text</label>
          <textarea id="adapt-message" maxlength="180">Embed in texture, avoid smooth sky and flat regions.</textarea>
        </div>
        <div>
          <small>
            Label: WOW-inspired adaptive embedding — educational simplification. Real WOW/S-UNIWARD uses richer distortion modeling.
          </small>
        </div>
      </div>
      <div class="controls">
        <button id="adapt-map" type="button">Compute texture map</button>
        <button id="adapt-embed" type="button">Adaptive embed</button>
        <button id="adapt-seq" type="button">Sequential LSB embed</button>
        <button id="adapt-compare" type="button">Compare chi-squared detectability</button>
      </div>
      <div class="stats" id="adapt-stats"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>Texture cost map (green low cost, red high cost)</h4><canvas id="adapt-map-canvas" width="256" height="256"></canvas></div>
        <div class="figure"><h4>Adaptive embedding locations</h4><canvas id="adapt-locations" width="256" height="256"></canvas></div>
        <div class="figure"><h4>Sequential embedding locations</h4><canvas id="seq-locations" width="256" height="256"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> adaptive methods reduce detectability compared to naive sequential LSB,
        but modern ML steganalysis still detects many adaptive schemes at low payload rates.
      </div>
    </section>

    <section class="exhibit" id="exhibit-6">
      <h2>Exhibit 6 — Steganography in the Real World</h2>
      <div class="row">
        <div>
          <h3>Case A — Printer Tracking Dots</h3>
          <p>Invisible yellow dot patterns from major printers encode serial/time metadata; publicly documented by EFF (2005).</p>
          <p>Reality Winner (2017) was identified in part through printer dot metadata on leaked NSA material.</p>

          <h3>Case B — Digital Watermarking</h3>
          <p>Image/audio watermarking supports ownership and provenance workflows, including modern authenticity ecosystems such as C2PA.</p>

          <h3>Case C — Network Steganography</h3>
          <p>Covert channels can hide data in packet timing, sizes, or protocol fields (for example VoIP timing-channel techniques).</p>
        </div>
        <div>
          <h3>Case D — Malware C2</h3>
          <p>Some malware families have used media carriers for hidden command channels; defenders rely on behavioral and anomaly analysis.</p>

          <h3>Case E — Steganalysis Practice</h3>
          <p>Operational steganalysis uses statistical and ML pipelines; current research frontier remains adaptive embedding vs deep models.</p>

          <h3>Legal and Ethical Context</h3>
          <p>Steganography is dual-use: privacy-preserving for journalists/activists and potentially abused by adversaries.</p>
        </div>
      </div>
      <div class="links">
        <a href="https://systemslibrarian.github.io/snow2/" target="_blank" rel="noreferrer">Snow 2 demo</a>
        <a href="https://systemslibrarian.github.io/crypto-lab-shadow-vault/" target="_blank" rel="noreferrer">Shadow Vault demo</a>
        <a href="https://systemslibrarian.github.io/crypto-compare/" target="_blank" rel="noreferrer">Crypto Compare reference</a>
      </div>
    </section>
  </main>
`;function ct(){const t=document.documentElement,e=document.getElementById("theme-toggle");if(!e)return;const n=()=>{const a=t.getAttribute("data-theme")!=="light";e.textContent=a?"🌙":"☀️",e.setAttribute("aria-label",a?"Switch to light mode":"Switch to dark mode")};n(),e.addEventListener("click",()=>{const s=(t.getAttribute("data-theme")==="light"?"light":"dark")==="dark"?"light":"dark";t.setAttribute("data-theme",s),localStorage.setItem("theme",s),n()})}function dt(t,e){const n=new Uint8ClampedArray(t*e*4);for(let a=0;a<e;a+=1)for(let s=0;s<t;s+=1){const i=(a*t+s)*4,o=a/e,r=s/t,c=z(s,a,U),d=Math.sin(r*Math.PI*6)*.5+.5,h=.58-o;let l=v(40+95*d+30*c+70*Math.max(0,h)),p=v(65+110*d+70*o+25*c),m=v(90+80*o+20*c+80*Math.max(0,h));if(a>e*.58){const f=z(s*2,a*2,U+9)*60;p=v(p+f),l=v(l+f*.3)}n[i]=l,n[i+1]=p,n[i+2]=m,n[i+3]=255}return new ImageData(n,t,e)}function z(t,e,n){const a=Math.sin(t*12.9898+e*78.233+n*37.719)*43758.5453;return a-Math.floor(a)}function v(t){return Math.max(0,Math.min(255,Math.round(t)))}function y(t){const e=document.getElementById(t);if(!e)throw new Error(`Canvas not found: ${t}`);const n=e.getContext("2d");if(!n)throw new Error(`2D context unavailable: ${t}`);return n}function C(t,e){t.putImageData(e,0,0)}function E(t){return new ImageData(new Uint8ClampedArray(t.data),t.width,t.height)}function q(t){const e=[];for(const n of t)for(let a=7;a>=0;a-=1)e.push(n>>a&1);return e}function M(t){const e=new Uint8Array(Math.ceil(t.length/8));for(let n=0;n<t.length;n+=1){const a=Math.floor(n/8);e[a]=e[a]<<1|t[n],n%8!==7&&n===t.length-1&&(e[a]<<=7-n%8)}return e}function K(t){return new Uint8Array([t>>>24&255,t>>>16&255,t>>>8&255,t&255])}function L(t,e){return t[e]<<24>>>0|t[e+1]<<16|t[e+2]<<8|t[e+3]}function j(t){const e=K(t.length),n=new Uint8Array(e.length+t.length);return n.set(e,0),n.set(t,4),n}function J(t){const e=L(t,0);return t.slice(4,4+e)}function lt(t,e){const n=K(e.length),a=new Uint8Array(5+e.length);return a[0]=t,a.set(n,1),a.set(e,5),a}function ht(t){const e=t[0]??0,n=L(t,1);return{mode:e,payload:t.slice(5,5+n)}}function X(t){return t.width*t.height*3}function _(t,e){const n=E(t),a=n.data;let s=0,i=null;for(let o=0;o<a.length&&s<e.length;o+=1){if(o%4===3)continue;const r=a[o],c=e[s],d=r&254|c;if(a[o]=d,!i&&r!==d){const h=Math.floor(o/4%t.width),l=Math.floor(o/4/t.width);i={valueBefore:r,valueAfter:d,bit:c,x:h,y:l}}s+=1}return{stego:n,firstChange:i}}function G(t,e){const n=[],a=t.data;for(let s=0;s<a.length&&n.length<e;s+=1)s%4!==3&&n.push(a[s]&1);return n}async function ut(t,e){const n=new TextEncoder,a=crypto.getRandomValues(new Uint8Array(16)),s=crypto.getRandomValues(new Uint8Array(12)),i=await crypto.subtle.importKey("raw",n.encode(e),"PBKDF2",!1,["deriveKey"]),o=await crypto.subtle.deriveKey({name:"PBKDF2",salt:a,iterations:12e4,hash:"SHA-256"},i,{name:"AES-GCM",length:256},!1,["encrypt"]),r=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:s},o,n.encode(t))),c=new Uint8Array(28+r.length);return c.set(a,0),c.set(s,16),c.set(r,28),c}async function pt(t,e){const n=new TextDecoder,a=new TextEncoder,s=t.slice(0,16),i=t.slice(16,28),o=t.slice(28),r=await crypto.subtle.importKey("raw",a.encode(e),"PBKDF2",!1,["deriveKey"]),c=await crypto.subtle.deriveKey({name:"PBKDF2",salt:s,iterations:12e4,hash:"SHA-256"},r,{name:"AES-GCM",length:256},!1,["decrypt"]),d=await crypto.subtle.decrypt({name:"AES-GCM",iv:i},c,o);return n.decode(d)}function H(t,e,n,a){const s=y(e),i=10,o=document.createElement("canvas");o.width=i,o.height=i;const r=o.getContext("2d");if(!r)return;const c=new ImageData(i,i);for(let d=0;d<i;d+=1)for(let h=0;h<i;h+=1){const l=Math.min(t.width-1,n+h),m=(Math.min(t.height-1,a+d)*t.width+l)*4,f=(d*i+h)*4;c.data[f]=t.data[m],c.data[f+1]=t.data[m+1],c.data[f+2]=t.data[m+2],c.data[f+3]=255}r.putImageData(c,0,0),s.clearRect(0,0,200,200),s.imageSmoothingEnabled=!1,s.drawImage(o,0,0,200,200)}function T(t){const e=new Array(256).fill(0),n=t.data;for(let a=0;a<n.length;a+=4)e[n[a]]+=1,e[n[a+1]]+=1,e[n[a+2]]+=1;return e}function F(t,e){const n=y(e),a=n.canvas.width,s=n.canvas.height;n.clearRect(0,0,a,s);const i=Math.max(...t,1);n.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim()||"currentColor";for(let o=0;o<256;o+=1){const r=o/256*a,c=t[o]/i*(s-8);n.fillRect(r,s-c,Math.max(1,a/256),c)}}function S(t){const e=T(t);let n=0;for(let i=0;i<128;i+=1){const o=e[2*i],r=e[2*i+1],c=(o+r)/2;c>0&&(n+=(o-c)*(o-c)/c,n+=(r-c)*(r-c)/c)}const a=127,s=mt(a/2,n/2);return{chi2:n,pValue:s,dof:a}}function mt(t,e){return e<0||t<=0?Number.NaN:e<t+1?1-gt(t,e):ft(t,e)}function gt(t,e){let s=1/t,i=s,o=t;for(let r=1;r<=100;r+=1)if(o+=1,i*=e/o,s+=i,Math.abs(i)<Math.abs(s)*3e-7)return s*Math.exp(-e+t*Math.log(e)-B(t));return s*Math.exp(-e+t*Math.log(e)-B(t))}function ft(t,e){let i=e+1-t,o=1/1e-30,r=1/i,c=r;for(let d=1;d<=100;d+=1){const h=-d*(d-t);i+=2,r=h*r+i,Math.abs(r)<1e-30&&(r=1e-30),o=i+h/o,Math.abs(o)<1e-30&&(o=1e-30),r=1/r;const l=r*o;if(c*=l,Math.abs(l-1)<3e-7)break}return Math.exp(-e+t*Math.log(e)-B(t))*c}function B(t){const e=[76.18009172947146,-86.50532032941678,24.01409824083091,-1.231739572450155,.001208650973866179,-5395239384953e-18];let n=t-1,a=n+5.5;a-=(n+.5)*Math.log(a);let s=1.000000000190015;for(let i=0;i<e.length;i+=1)n+=1,s+=e[i]/n;return-a+Math.log(2.5066282746310007*s)}function W(t,e,n){const a=y(t),s=a.canvas.width,i=a.canvas.height,o=n*2.5,r=o/s,c=l=>{if(l<=0)return 0;const p=n/2,m=(p-1)*Math.log(l)-l/2-p*Math.log(2)-B(p);return Math.exp(m)};let d=0;for(let l=.001;l<=o;l+=r)d=Math.max(d,c(l));a.clearRect(0,0,s,i),a.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim()||"currentColor",a.lineWidth=2,a.beginPath();for(let l=0;l<s;l+=1){const p=l*r,m=i-c(p)/d*(i-20)-10;l===0?a.moveTo(l,m):a.lineTo(l,m)}a.stroke();const h=Math.max(0,Math.min(s-1,e/o*s));a.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()||"currentColor",a.beginPath(),a.moveTo(h,8),a.lineTo(h,i-8),a.stroke()}function Y(t){const e=new Float64Array(t.width*t.height);for(let n=0,a=0;n<t.data.length;n+=4,a+=1){const s=t.data[n],i=t.data[n+1],o=t.data[n+2];e[a]=.299*s+.587*i+.114*o}return e}function bt(t){const e=Array.from({length:8},()=>new Array(8).fill(0));for(let n=0;n<8;n+=1)for(let a=0;a<8;a+=1){const s=n===0?1/Math.sqrt(2):1,i=a===0?1/Math.sqrt(2):1;let o=0;for(let r=0;r<8;r+=1)for(let c=0;c<8;c+=1)o+=t[c][r]*Math.cos((2*r+1)*n*Math.PI/16)*Math.cos((2*c+1)*a*Math.PI/16);e[a][n]=.25*s*i*o}return e}function yt(t){const e=Array.from({length:8},()=>new Array(8).fill(0));for(let n=0;n<8;n+=1)for(let a=0;a<8;a+=1){let s=0;for(let i=0;i<8;i+=1)for(let o=0;o<8;o+=1){const r=i===0?1/Math.sqrt(2):1,c=o===0?1/Math.sqrt(2):1;s+=r*c*t[o][i]*Math.cos((2*a+1)*i*Math.PI/16)*Math.cos((2*n+1)*o*Math.PI/16)}e[n][a]=.25*s}return e}const Q=[[0,1],[1,0],[2,0],[1,1],[0,2],[0,3],[1,2],[2,1],[3,0],[4,0],[3,1],[2,2],[1,3],[0,4],[0,5],[1,4],[2,3],[3,2],[4,1],[5,0],[6,0],[5,1],[4,2],[3,3],[2,4],[1,5],[0,6],[0,7],[1,6],[2,5],[3,4],[4,3],[5,2],[6,1],[7,0],[7,1],[6,2],[5,3],[4,4],[3,5],[2,6],[1,7],[2,7],[3,6],[4,5],[5,4],[6,3],[7,2],[7,3],[6,4],[5,5],[4,6],[3,7],[4,7],[5,6],[6,5],[7,4],[7,5],[6,6],[5,7],[6,7],[7,6],[7,7]];function I(t){const e=Y(t),n=Math.floor(t.width/8),a=Math.floor(t.height/8),s=[];for(let i=0;i<a;i+=1)for(let o=0;o<n;o+=1){const r=Array.from({length:8},()=>new Array(8).fill(0));for(let c=0;c<8;c+=1)for(let d=0;d<8;d+=1){const h=o*8+d,l=i*8+c;r[c][d]=e[l*t.width+h]-128}s.push(bt(r))}return{blocks:s,blocksX:n,blocksY:a,width:t.width,height:t.height,modified:new Set,embedded:!1}}function vt(t,e){let n=0;t.modified.clear();for(let a=0;a<t.blocks.length&&n<e.length;a+=1){const s=t.blocks[a];for(const[i,o]of Q){if(n>=e.length)break;let r=Math.round(s[o][i]);if(r===0)continue;const c=e[n];Math.abs(r)%2!==c&&(r=r>0?r+1:r-1,r===0&&(r=c===1?1:-1),s[o][i]=r,t.modified.add(`${a}:${i}:${o}`)),n+=1}}return t.embedded=n===e.length,n}function N(t,e){const n=[];for(let a=0;a<t.blocks.length&&n.length<e;a+=1){const s=t.blocks[a];for(const[i,o]of Q){if(n.length>=e)break;const r=Math.round(s[o][i]);r!==0&&n.push(Math.abs(r)%2)}}return n}function wt(t){const e=new ImageData(t.width,t.height);let n=0;for(let a=0;a<t.blocksY;a+=1)for(let s=0;s<t.blocksX;s+=1){const i=yt(t.blocks[n]);for(let o=0;o<8;o+=1)for(let r=0;r<8;r+=1){const c=s*8+r,h=((a*8+o)*t.width+c)*4,l=v(i[o][r]+128);e.data[h]=l,e.data[h+1]=l,e.data[h+2]=l,e.data[h+3]=255}n+=1}return e}function P(t,e,n,a){const s=y(t),i=s.canvas.width,o=Math.floor(i/8);let r=1;for(let c=0;c<8;c+=1)for(let d=0;d<8;d+=1)r=Math.max(r,Math.abs(e[c][d]));s.clearRect(0,0,i,i);for(let c=0;c<8;c+=1)for(let d=0;d<8;d+=1){const h=Math.abs(e[c][d])/r,l=Math.round(25+h*70);s.fillStyle=`hsl(200 70% ${l}%)`,s.fillRect(d*o,c*o,o,o);const p=`${a}:${d}:${c}`;s.strokeStyle=n.has(p)?getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()||"currentColor":getComputedStyle(document.documentElement).getPropertyValue("--border").trim()||"currentColor",s.strokeRect(d*o,c*o,o,o)}}function Z(t){const e=t.width,n=t.height,a=Y(t),s=new Float64Array(e*n),i=[-1,0,1,-2,0,2,-1,0,1],o=[-1,-2,-1,0,0,0,1,2,1];for(let r=1;r<n-1;r+=1)for(let c=1;c<e-1;c+=1){let d=0,h=0,l=0;for(let p=-1;p<=1;p+=1)for(let m=-1;m<=1;m+=1){const f=a[(r+p)*e+(c+m)];d+=f*i[l],h+=f*o[l],l+=1}s[r*e+c]=Math.hypot(d,h)}return s}function tt(t,e,n){const a=y(n),s=e.width,i=e.height,o=new ImageData(s,i);let r=1;for(const c of t)c>r&&(r=c);for(let c=0;c<t.length;c+=1){const d=t[c]/r,h=v((1-d)*230),l=v(d*220),p=c*4;o.data[p]=h,o.data[p+1]=l,o.data[p+2]=70,o.data[p+3]=220}a.putImageData(o,0,0)}function et(t,e,n){const a=E(t),s=new Uint32Array(e.length);for(let i=0;i<e.length;i+=1){const o=n[i],r=o*4+2;a.data[r]=a.data[r]&254|e[i],s[i]=o}return{stego:a,changed:s}}function A(t,e,n){const a=y(n);a.putImageData(t,0,0),a.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--danger").trim()||"currentColor";for(let s=0;s<e.length;s+=1){const i=e[s],o=i%t.width,r=Math.floor(i/t.width);a.fillRect(o,r,1,1)}}function R(t){const e=new TextEncoder().encode(t);return q(j(e))}function xt(t){const e=M(t.slice(0,32)),a=(L(e,0)+4)*8,s=M(t.slice(0,a)),i=J(s);return new TextDecoder().decode(i)}const u=dt(V,V);let g=E(u),b=I(u),$=E(u),k=Z(u),nt=E(u),at=E(u);const Et=y("lsb-cover"),st=y("lsb-stego");C(Et,u);C(st,g);H(u,"lsb-zoom-cover",80,80);H(g,"lsb-zoom-stego",80,80);F(T(u),"lsb-hist-cover");F(T(g),"lsb-hist-stego");const ot=y("dct-image");C(ot,$);tt(k,u,"adapt-map-canvas");A(u,new Uint32Array(0),"adapt-locations");A(u,new Uint32Array(0),"seq-locations");W("chi-plot",127,127);const w=document.getElementById("lsb-stats"),it=document.getElementById("chi-results"),Mt=document.getElementById("chi-curve"),D=document.getElementById("dct-stats"),x=document.getElementById("adapt-stats");document.getElementById("lsb-embed").addEventListener("click",async()=>{const t=document.getElementById("lsb-message").value,e=document.getElementById("lsb-encrypt").checked,n=document.getElementById("lsb-passphrase").value;if(!t){w.innerHTML='<span class="status-warn">Provide a message first.</span>';return}if(e&&!n){w.innerHTML='<span class="status-warn">Encryption selected: passphrase is required.</span>';return}const a=new TextEncoder().encode(t),s=e?await ut(t,n):a,i=lt(e?1:0,s),o=j(i),r=q(o),c=X(u);if(r.length>c){w.innerHTML=`<span class="status-warn">Payload too large: ${r.length} bits required, ${c} bits available.</span>`;return}const d=_(u,r);g=d.stego,C(st,g),H(g,"lsb-zoom-stego",80,80),F(T(g),"lsb-hist-stego");const h=d.firstChange?`Pixel (${d.firstChange.x}, ${d.firstChange.y}) channel before ${d.firstChange.valueBefore} (LSB ${d.firstChange.valueBefore&1}), after ${d.firstChange.valueAfter} (LSB ${d.firstChange.valueAfter&1}), payload bit ${d.firstChange.bit}.`:"No first-change sample available (all initial bits matched existing LSBs).";w.innerHTML=`
    <div>Payload: ${a.length} bytes plaintext, ${s.length} bytes stored. Capacity: ${(c/8).toFixed(0)} bytes.</div>
    <div>Mode: ${e?"AES-256-GCM then steganography":"Plaintext steganography"}.</div>
    <div>${h}</div>
  `});document.getElementById("lsb-extract").addEventListener("click",async()=>{const t=G(g,32),e=M(t),a=(L(e,0)+4)*8,s=G(g,a),i=M(s),o=J(i),r=ht(o);let c="",d="plain",h=!1;if(r.mode===1){d="encrypted";const p=document.getElementById("lsb-passphrase").value;if(!p){w.innerHTML='<span class="status-warn">Encrypted payload found: enter passphrase to decrypt.</span>';return}h=!0;try{c=await pt(r.payload,p)}catch{w.innerHTML='<span class="status-warn">Decryption failed. Check passphrase.</span>';return}}else c=new TextDecoder().decode(r.payload);const l={mode:d,message:c,passphraseUsed:h};w.innerHTML=`Recovered: <strong>${rt(l.message)}</strong><br/>Mode: ${l.mode}${l.passphraseUsed?" (passphrase used)":""}`});document.getElementById("lsb-download").addEventListener("click",()=>{const t=document.createElement("canvas");t.width=g.width,t.height=g.height;const e=t.getContext("2d");if(!e)return;e.putImageData(g,0,0);const n=document.createElement("a");n.href=t.toDataURL("image/png"),n.download="stego-lsb.png",n.click()});document.getElementById("chi-test-cover").addEventListener("click",()=>{const t=S(u);W("chi-plot",t.chi2,t.dof);const e=t.pValue<.05;it.innerHTML=`
    Cover test: χ²=${t.chi2.toFixed(2)}, p=${t.pValue.toExponential(3)}
    <span class="${e?"status-warn":"status-ok"}">${e?"✗ Steganography likely present":"✓ No steganography detected"}</span>
  `});document.getElementById("chi-test-stego").addEventListener("click",()=>{const t=S(g);W("chi-plot",t.chi2,t.dof);const e=t.pValue<.05;it.innerHTML=`
    Stego test: χ²=${t.chi2.toFixed(2)}, p=${t.pValue.toExponential(3)}
    <span class="${e?"status-warn":"status-ok"}">${e?"✗ Steganography likely present":"✓ No steganography detected"}</span>
  `});document.getElementById("chi-run-curve").addEventListener("click",()=>{const t=[.1,.5,1],e=X(u),n=t.map(a=>{const s=Math.floor(e*a),i=crypto.getRandomValues(new Uint8Array(Math.ceil(s/8))),o=q(i).slice(0,s),r=_(u,o).stego,c=S(r);return`<tr><td>${Math.round(a*100)}%</td><td>${s.toLocaleString()}</td><td>${c.chi2.toFixed(2)}</td><td>${c.pValue.toExponential(3)}</td></tr>`});Mt.innerHTML=`<table><thead><tr><th>Payload rate</th><th>Bits</th><th>χ²</th><th>p-value</th></tr></thead><tbody>${n.join("")}</tbody></table>`});document.getElementById("dct-transform").addEventListener("click",()=>{b=I(u),P("dct-before",b.blocks[0],new Set,0),D.innerHTML="Computed 8×8 block DCT over the image. Showing block 0 heatmap."});document.getElementById("dct-embed").addEventListener("click",()=>{const t=document.getElementById("dct-message").value,e=R(t);b=I(u);const n=vt(b,e);P("dct-before",I(u).blocks[0],new Set,0),P("dct-after",b.blocks[0],b.modified,0),D.innerHTML=`Embedded ${n} bits into non-zero AC coefficients with ±1 coefficient edits. ${b.embedded?"Complete payload embedded.":"Capacity reached before full payload."}`});document.getElementById("dct-inverse").addEventListener("click",()=>{$=wt(b),C(ot,$),D.innerHTML+=" Inverse DCT rendered to spatial-domain image."});document.getElementById("dct-extract").addEventListener("click",()=>{const t=N(b,32),n=(L(M(t),0)+4)*8,a=N(b,n),s=xt(a);D.innerHTML=`Recovered from DCT coefficient stream: <strong>${rt(s)}</strong>`});document.getElementById("adapt-map").addEventListener("click",()=>{k=Z(u),tt(k,u,"adapt-map-canvas"),x.innerHTML="Texture map computed via Sobel gradient magnitude. High texture = lower embedding cost."});document.getElementById("adapt-embed").addEventListener("click",()=>{const t=document.getElementById("adapt-message").value,e=R(t),n=u.width*u.height;if(e.length>n){x.innerHTML='<span class="status-warn">Payload too large for adaptive blue-channel carrier.</span>';return}const a=new Uint32Array(n);for(let o=0;o<n;o+=1)a[o]=o;a.sort((o,r)=>k[r]-k[o]);const{stego:s,changed:i}=et(u,e,a);nt=s,A(u,i,"adapt-locations"),x.innerHTML=`Adaptive embedding wrote ${e.length} bits, clustered in textured regions first.`});document.getElementById("adapt-seq").addEventListener("click",()=>{const t=document.getElementById("adapt-message").value,e=R(t),n=u.width*u.height;if(e.length>n){x.innerHTML='<span class="status-warn">Payload too large for sequential baseline.</span>';return}const a=new Uint32Array(n);for(let o=0;o<n;o+=1)a[o]=o;const{stego:s,changed:i}=et(u,e,a);at=s,A(u,i,"seq-locations"),x.innerHTML+=" Sequential baseline plotted for comparison."});document.getElementById("adapt-compare").addEventListener("click",()=>{const t=S(nt),e=S(at);x.innerHTML=`Same payload, different placement: sequential p=${e.pValue.toExponential(3)}, adaptive p=${t.pValue.toExponential(3)}. Higher p-value indicates reduced detectability, not invisibility.`});function rt(t){return t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}ct();
