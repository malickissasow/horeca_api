import os
import sys
import ftplib
import ssl
import time

FTP_HOST = os.getenv("FTP_HOST", "92.113.24.18")
FTP_PORT = int(os.getenv("FTP_PORT", "21"))
FTP_USER = os.getenv("FTP_USER", "u208608546.api.horecafrica.org")
FTP_PASS = os.getenv("FTP_PASS", "B5@9ll@c")
LOCAL_DIR = os.getenv("LOCAL_DIR", ".")

EXCLUDE_DIRS = {".git", ".github", "node_modules", "uploads", "tmp"}
EXCLUDE_FILES = {".env", "README.md", "deploy_api_ftp.py"}

def connect_ftp():
    print(f"🚀 Connecting to Hostinger FTP {FTP_HOST}:{FTP_PORT}...")
    for attempt in range(1, 4):
        try:
            print(f"🔒 Attempt {attempt}/3: Connecting via FTPS (TLS)...")
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

            ftps = ftplib.FTP_TLS(context=context)
            ftps.trust_server_pasv_ipv4_address = True
            ftps.connect(FTP_HOST, FTP_PORT, timeout=20)
            ftps.login(FTP_USER, FTP_PASS)
            ftps.prot_p()
            ftps.set_pasv(True)
            print("🔒 Connected & Logged in via FTPS!")
            return ftps
        except Exception as e:
            print(f"⚠️ FTPS Attempt {attempt} failed ({e})")

        try:
            print(f"⚡ Attempt {attempt}/3: Connecting via Plain FTP...")
            ftp = ftplib.FTP()
            ftp.trust_server_pasv_ipv4_address = True
            ftp.connect(FTP_HOST, FTP_PORT, timeout=20)
            ftp.login(FTP_USER, FTP_PASS)
            ftp.set_pasv(True)
            print("✅ Connected & Logged in via Plain FTP!")
            return ftp
        except Exception as e:
            print(f"⚠️ Plain FTP Attempt {attempt} failed ({e})")

        if attempt < 3:
            time.sleep(3)

    raise RuntimeError(f"❌ Failed to connect to Hostinger FTP {FTP_HOST} after 3 attempts.")

def ensure_remote_dir(ftp, base_path, rel_dir):
    current = base_path.rstrip("/")
    if rel_dir and rel_dir != ".":
        dirs = [d for d in rel_dir.split(os.sep) if d]
        for d in dirs:
            current += "/" + d
            try:
                ftp.cwd(current)
            except ftplib.error_perm:
                try:
                    ftp.mkd(current)
                    print(f"📁 Created remote directory: {current}")
                except Exception as e:
                    print(f"Warning creating {current}: {e}")

def safe_upload_file(ftp, local_file, file_name):
    try:
        ftp.delete(f".in.{file_name}.")
    except Exception:
        pass

    try:
        with open(local_file, "rb") as f:
            ftp.storbinary(f"STOR {file_name}", f)
    except Exception as e:
        print(f"⚠️ Retry upload for {file_name} ({e})...")
        try:
            ftp.delete(f".in.{file_name}.")
        except Exception:
            pass
        try:
            with open(local_file, "rb") as f:
                ftp.storbinary(f"STOR {file_name}", f)
        except Exception as e2:
            print(f"Warning storing {file_name}: {e2}")

def deploy_to_target(ftp, target_base_dir):
    print(f"\n📤 Uploading API files to target directory: {target_base_dir}...")
    file_count = 0

    for root, dirs, files in os.walk(LOCAL_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        rel_path = os.path.relpath(root, LOCAL_DIR)

        ensure_remote_dir(ftp, target_base_dir, rel_path)

        if rel_path == ".":
            target_cwd = target_base_dir
        else:
            target_cwd = f"{target_base_dir.rstrip('/')}/{rel_path.replace(os.sep, '/')}"

        try:
            ftp.cwd(target_cwd)
        except Exception as e:
            print(f"Error CWD to {target_cwd}: {e}")
            continue

        for file in files:
            if file in EXCLUDE_FILES or file.endswith(".sql"):
                continue
            local_file = os.path.join(root, file)
            print(f"  [{target_base_dir}] -> {rel_path}/{file}")
            safe_upload_file(ftp, local_file, file)
            file_count += 1

    print(f"✅ Target {target_base_dir} updated with {file_count} files.")

def main():
    ftp = connect_ftp()

    # Determine existing target directories
    root_nlst = []
    try:
        root_nlst = ftp.nlst()
    except Exception:
        pass

    targets = ["/public_html"]
    if "nodejs" in root_nlst:
        targets.append("/public_html/nodejs")

    print(f"🎯 Detected target deployment locations on Hostinger: {targets}")

    for target in targets:
        deploy_to_target(ftp, target)

    try:
        ftp.quit()
    except Exception:
        pass

    print(f"\n🎉 All API deployment targets updated successfully!")

if __name__ == "__main__":
    main()
