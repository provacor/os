#!/usr/bin/env python3
"""Build the Provacor Android app (APK) and publish it, password-locked, on the website.

Two stages, so the password and signing key never leave this machine:

  1. compile (GitHub Actions, .github/workflows/apk.yml — uses the official Android SDK):
       python3 tools/apk/build.py compile --sdk $ANDROID_HOME --out unsigned.apk
     bundles the web app (everything except the notes PDFs) inside the APK, so it works offline
     from the first launch (online, the app keeps itself updated from the website), and compiles
     tools/apk/src. The workflow pushes unsigned.apk to the `apk-unsigned` branch.

  2. sign (locally):
       git fetch origin apk-unsigned && git show origin/apk-unsigned:unsigned.apk > /tmp/u.apk
       APK_PASSWORD=… python3 tools/apk/build.py sign /tmp/u.apk
     aligns and signs it (APK Signature Scheme v2) with tools/apk/release-key.p12, which is locked
     with the same password (the first run creates it; keep the password — Android only installs an
     update signed with the same key), then encrypts the APK with the password (PBKDF2-SHA256 +
     AES-256-GCM) into apk/provacor.apk.enc. apk/index.html decrypts it in the browser, so only
     someone with the password can download it.

Needs Python 3 with `cryptography` (and Pillow for the compile stage) and a JDK.
"""
import argparse, hashlib, io, json, os, shutil, struct, subprocess, sys, tempfile, time, zipfile
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tools' / 'apk'
SITE = 'https://provacor.github.io/os/'
KEY = HERE / 'release-key.p12'
OUT = ROOT / 'apk'
PBKDF2_ITERS = 600_000


def run(*cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'failed: {" ".join(map(str, cmd))}\n{r.stdout}\n{r.stderr}')
    return r.stdout


# ---------- web app bundle ----------

def bundle(dst):
    www = dst / 'www'
    for name in ['index.html', 'manifest.webmanifest', 'icon.svg']:
        shutil.copy2(ROOT / name, www / name) if www.exists() else (www.mkdir(parents=True), shutil.copy2(ROOT / name, www / name))
    shutil.copytree(ROOT / 'assets', www / 'assets')
    shutil.copytree(ROOT / 'data', www / 'data')
    shutil.copytree(ROOT / 'content', www / 'content', ignore=lambda d, names: [n for n in names if n.lower().endswith(('.pdf', '.md'))])
    shutil.copy2(HERE / 'app-bridge.js', dst / 'app-bridge.js')


def icons(res):
    from PIL import Image, ImageDraw
    for folder, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        s = 8  # draw large, then scale down for smooth edges
        n = px * s
        img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        k = n / 64  # icon.svg uses a 64×64 view box
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=14 * k, fill='#4f46e5')
        d.polygon([(12 * k, 26 * k), (32 * k, 16 * k), (52 * k, 26 * k), (32 * k, 36 * k)], fill='#ffffff')
        d.polygon([(20 * k, 31 * k), (20 * k, 40 * k), (32 * k, 46 * k), (44 * k, 40 * k), (44 * k, 31 * k), (32 * k, 37 * k)], fill='#c7c4ff')
        out = res / f'mipmap-{folder}'
        out.mkdir(parents=True, exist_ok=True)
        img.resize((px, px), Image.LANCZOS).save(out / 'ic_launcher.png')


# ---------- signing key ----------

def load_key(password):
    if KEY.exists():
        key, cert, _ = pkcs12.load_key_and_certificates(KEY.read_bytes(), password.encode())
        return key, cert
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Provacor')])
    now = time.time()
    import datetime
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.fromtimestamp(now - 86400, datetime.timezone.utc))
            .not_valid_after(datetime.datetime.fromtimestamp(now + 86400 * 365 * 40, datetime.timezone.utc))
            .sign(key, hashes.SHA256()))
    KEY.write_bytes(pkcs12.serialize_key_and_certificates(b'provacor', key, cert, None, serialization.BestAvailableEncryption(password.encode())))
    print(f'created a new signing key: {KEY.name}')
    return key, cert


# ---------- zip: align stored entries (resources.arsc must be uncompressed and 4-byte aligned) ----------

def assemble(unsigned, out):
    with zipfile.ZipFile(unsigned) as src, open(out, 'wb') as f:
        z = zipfile.ZipFile(f, 'w')
        for info in src.infolist():
            if info.filename.startswith('META-INF/'):
                continue  # any old signature
            data = src.read(info.filename)
            zi = zipfile.ZipInfo(info.filename, date_time=(2020, 1, 1, 0, 0, 0))
            stored = info.filename == 'resources.arsc' or info.compress_type == zipfile.ZIP_STORED
            zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            if stored:
                data_start = f.tell() + 30 + len(zi.filename.encode())
                zi.extra = b'\0' * ((-data_start) % 4)
            z.writestr(zi, data)
        z.close()


# ---------- APK Signature Scheme v2 ----------

def lp(b):
    return struct.pack('<I', len(b)) + b


def sign_v2(path, key, cert):
    data = Path(path).read_bytes()
    eocd = data.rfind(b'PK\x05\x06')
    cd_off = struct.unpack_from('<I', data, eocd + 16)[0]
    entries, cd, end = data[:cd_off], data[cd_off:eocd], data[eocd:]

    def chunks(b):
        return [b[i:i + 1048576] for i in range(0, len(b), 1048576)] or [b'']

    parts = [c for sec in (entries, cd, end) for c in chunks(sec)]
    top = hashlib.sha256(b'\x5a' + struct.pack('<I', len(parts)) + b''.join(
        hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest() for c in parts)).digest()

    alg = 0x0103  # RSASSA-PKCS1-v1_5 with SHA2-256
    signed = lp(lp(struct.pack('<I', alg) + lp(top))) + lp(lp(cert.public_bytes(serialization.Encoding.DER))) + lp(b'')
    sig = key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed) + lp(lp(struct.pack('<I', alg) + lp(sig))) + lp(pub)
    value = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(value)) + struct.pack('<I', 0x7109871A) + value
    size = len(pair) + 8 + 16
    block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'
    end = end[:16] + struct.pack('<I', cd_off + len(block)) + end[20:]
    Path(path).write_bytes(entries + block + cd + end)


# ---------- password lock for the website ----------

def encrypt(apk, password, meta):
    salt, iv = os.urandom(16), os.urandom(12)
    k = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=PBKDF2_ITERS).derive(password.encode())
    OUT.mkdir(exist_ok=True)
    (OUT / 'provacor.apk.enc').write_bytes(b'PVC1' + salt + iv + AESGCM(k).encrypt(iv, Path(apk).read_bytes(), None))
    (OUT / 'apk.json').write_text(json.dumps({**meta, 'iterations': PBKDF2_ITERS}, ensure_ascii=False, indent=1) + '\n')


def compile_apk(sdk, out):
    sdk = Path(sdk)
    bt = sorted((sdk / 'build-tools').iterdir(), key=lambda p: [int(x) if x.isdigit() else 0 for x in p.name.replace('-', '.').split('.')])[-1]
    platform = sorted((sdk / 'platforms').glob('android-*'), key=lambda p: int(''.join(c for c in p.name if c.isdigit()) or 0))[-1]
    android_jar = platform / 'android.jar'
    print(f'build-tools {bt.name}, {platform.name}')
    version_code = int(time.time() // 60)
    version_name = time.strftime('%Y.%m.%d-%H%M')
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        bundle(t / 'assets')
        icons(t / 'res')
        run(bt / 'aapt2', 'compile', '--dir', t / 'res', '-o', t / 'res.zip')
        run(bt / 'aapt2', 'link', '-o', t / 'base.apk', '-I', android_jar, '--manifest', HERE / 'AndroidManifest.xml',
            '--min-sdk-version', '24', '--target-sdk-version', '34', '--version-code', version_code,
            '--version-name', version_name, '-A', t / 'assets', t / 'res.zip')
        gen = t / 'gen' / 'com' / 'provacor' / 'app'
        gen.mkdir(parents=True)
        (gen / 'BuildConfig.java').write_text(f'package com.provacor.app;\n\nfinal class BuildConfig {{\n    static final String SITE = "{SITE}";\n}}\n')
        sources = [*map(str, (HERE / 'src').rglob('*.java')), str(gen / 'BuildConfig.java')]
        (t / 'classes').mkdir()
        run('javac', '--release', '8', '-nowarn', '-cp', android_jar, '-d', t / 'classes', *sources)
        (t / 'dex').mkdir()
        run(bt / 'd8', '--release', '--min-api', '24', '--lib', android_jar, '--output', t / 'dex', *[str(p) for p in (t / 'classes').rglob('*.class')])
        shutil.copy2(t / 'base.apk', out)
        with zipfile.ZipFile(out, 'a', zipfile.ZIP_DEFLATED) as z:
            z.write(t / 'dex' / 'classes.dex', 'classes.dex')
    print(f'unsigned APK {version_name} → {out}')


def sign_apk(unsigned, keep=None):
    password = os.environ.get('APK_PASSWORD', '')
    if len(password) < 12:
        sys.exit('set APK_PASSWORD (at least 12 characters)')
    key, cert = load_key(password)
    with zipfile.ZipFile(unsigned) as z:
        manifest_ok = 'AndroidManifest.xml' in z.namelist() and 'classes.dex' in z.namelist()
    if not manifest_ok:
        sys.exit(f'{unsigned} is not an app package')
    with tempfile.TemporaryDirectory() as t:
        apk = Path(t) / 'provacor.apk'
        assemble(unsigned, apk)
        sign_v2(apk, key, cert)
        if keep:
            shutil.copy2(apk, keep)
        data = apk.read_bytes()
        encrypt(apk, password, {'version': time.strftime('%Y.%m.%d'), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    print(f'signed APK ({len(data) / 1e6:.1f} MB) → apk/provacor.apk.enc')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('compile')
    c.add_argument('--sdk', required=True)
    c.add_argument('--out', required=True)
    s = sub.add_parser('sign')
    s.add_argument('unsigned')
    s.add_argument('--keep', help='also write the plain signed APK here (for testing; never commit it)')
    a = ap.parse_args()
    if a.cmd == 'compile':
        compile_apk(a.sdk, a.out)
    else:
        sign_apk(a.unsigned, a.keep)


if __name__ == '__main__':
    main()
