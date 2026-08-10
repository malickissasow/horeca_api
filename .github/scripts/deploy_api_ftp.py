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
REMOTE_DIR = os.getenv("REMOTE_DIR", "nodejs")

EXCLUDE_DIRS = {".git", ".github", "node_modules", "uploads", "tests", "tmp"}
EXCLUDE_FILES = {".env", ".env.local", ".env.production", ".env.example", ".DS_Store", "README.md"}

def connect_ftp():
    print(f"🚀 Connecting to FTP {FTP_HOST}:{FTP_PORT}...")
    for attempt in range(1, 4):
        # Try FTPS (Explicit TLS)
        try:
            print(f"🔒 Attempt {attempt}/3: Connecting via FTPS (TLS)...")
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

            ftps = ftplib.FTP_TLS(context=context)
            ftps.trust_server_pasv_ipv4_address = True
            ftps.connect(FTP_HOST, FTP_PORT, timeout=15)
            ftps.login(FTP_USER, FTP_PASS)
            ftps.prot_p()  # Enforce encrypted data channel
            ftps.set_pasv(True)
            print("🔒 Connected & Logged in via FTPS (Encrypted Data Channel)!")
            return ftps
        except Exception as e:
            print(f"⚠️ FTPS Attempt {attempt} failed ({e})")

        # Try Plain FTP
        try:
            print(f"⚡ Attempt {attempt}/3: Connecting via Plain FTP...")
            ftp = ftplib.FTP()
            ftp.trust_server_pasv_ipv4_address = True
            ftp.connect(FTP_HOST, FTP_PORT, timeout=15)
            ftp.login(FTP_USER, FTP_PASS)
            ftp.set_pasv(True)
            print("✅ Connected & Logged in via Plain FTP!")
            return ftp
        except Exception as e:
            print(f"⚠️ Plain FTP Attempt {attempt} failed ({e})")

        if attempt < 3:
            print("⏳ Waiting 3 seconds before next retry...")
            time.sleep(3)

    raise RuntimeError(f"❌ Failed to connect to Hostinger FTP {FTP_HOST} after 3 attempts.")

def ensure_remote_dir(ftp, remote_path):
    dirs = [d for d in remote_path.split("/") if d]
    current = ""
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

def upload_folder_recursive(ftp, local_folder, remote_target):
    if not os.path.exists(local_folder):
        return
    for root, dirs, files in os.walk(local_folder):
        rel = os.path.relpath(root, local_folder)
        target_path = remote_target if rel == "." else f"{remote_target}/{rel.replace(os.sep, '/')}"
        ensure_remote_dir(ftp, target_path)
        ftp.cwd(f"/{target_path}")
        for file in files:
            local_file = os.path.join(root, file)
            print(f"  -> [Nodemailer] Uploading {rel}/{file}...")
            with open(local_file, "rb") as f:
                ftp.storbinary(f"STOR {file}", f)

def deploy():
    ftp = connect_ftp()

    print(f"📤 Deploying API backend files to Hostinger Passenger dir: {REMOTE_DIR}/ (preserving uploads & .env)...")
    file_count = 0

    for root, dirs, files in os.walk(LOCAL_DIR):
        # Filter excluded directories in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        rel_path = os.path.relpath(root, LOCAL_DIR)
        if rel_path == ".":
            target_remote = REMOTE_DIR
        else:
            target_remote = f"{REMOTE_DIR}/{rel_path.replace(os.sep, '/')}"

        ensure_remote_dir(ftp, target_remote)
        ftp.cwd(f"/{target_remote}")

        for file in files:
            if file in EXCLUDE_FILES or file.startswith(".env"):
                print(f"  ⏭️ Skipping config/env file: {file}")
                continue

            local_file = os.path.join(root, file)
            print(f"  -> Uploading {rel_path}/{file} to /{target_remote}...")
            with open(local_file, "rb") as f:
                ftp.storbinary(f"STOR {file}", f)
            file_count += 1

    # Specifically upload node_modules/nodemailer if present
    local_nodemailer = os.path.join(LOCAL_DIR, "node_modules", "nodemailer")
    if os.path.exists(local_nodemailer):
        print("📦 Uploading nodemailer package to nodejs/node_modules/nodemailer...")
        upload_folder_recursive(ftp, local_nodemailer, f"{REMOTE_DIR}/node_modules/nodemailer")

    # Restart Node process via Passenger / Hostinger restart trigger
    try:
        ensure_remote_dir(ftp, f"{REMOTE_DIR}/tmp")
        ftp.cwd(f"/{REMOTE_DIR}/tmp")
        with open("restart_trigger.txt", "w") as f_tmp:
            f_tmp.write("restart")
        with open("restart_trigger.txt", "rb") as f_tmp:
            ftp.storbinary("STOR restart.txt", f_tmp)
        os.remove("restart_trigger.txt")
        print("🔄 Touched tmp/restart.txt to restart Hostinger Node.js Passenger process!")
    except Exception as e:
        print(f"Note on restart trigger: {e}")

    try:
        ftp.quit()
    except Exception:
        pass

    print(f"🎉 API Deployment completed! {file_count} files successfully uploaded to https://api.horecafrica.org")

if __name__ == "__main__":
    deploy()
