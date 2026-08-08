import os
import sys
import ftplib
import ssl

FTP_HOST = os.getenv("FTP_HOST", "92.113.24.18")
FTP_PORT = int(os.getenv("FTP_PORT", "21"))
FTP_USER = os.getenv("FTP_USER", "u208608546.api.horecafrica.org")
FTP_PASS = os.getenv("FTP_PASS", "B5@9ll@c")
LOCAL_DIR = os.getenv("LOCAL_DIR", ".")
REMOTE_DIR = os.getenv("REMOTE_DIR", "public_html")

EXCLUDE_DIRS = {".git", ".github", "node_modules", "uploads", "tests", "tmp"}
EXCLUDE_FILES = {".env", ".env.local", ".env.production", ".env.example", ".DS_Store", "README.md"}

def connect_ftp():
    print(f"🚀 Connecting to FTP {FTP_HOST}:{FTP_PORT} via FTPS (Explicit TLS)...")
    try:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        ftps = ftplib.FTP_TLS(context=context)
        ftps.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftps.login(FTP_USER, FTP_PASS)
        ftps.prot_p()  # Enforce encrypted data channel for cloud runners
        ftps.set_pasv(True)
        print("🔒 Connected & Logged in via FTPS (Encrypted Data Channel)!")
        return ftps
    except Exception as e:
        print(f"⚠️ FTPS connection failed ({e}), falling back to Plain FTP...")
        ftp = ftplib.FTP()
        ftp.connect(FTP_HOST, FTP_PORT, timeout=30)
        ftp.login(FTP_USER, FTP_PASS)
        ftp.set_pasv(True)
        print("✅ Connected & Logged in via Plain FTP!")
        return ftp

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

def deploy():
    ftp = connect_ftp()

    print(f"📤 Deploying API backend files to {REMOTE_DIR}/ (preserving uploads & .env)...")
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

    # Restart Node process via Passenger / Hostinger restart trigger
    try:
        ensure_remote_dir(ftp, f"{REMOTE_DIR}/tmp")
        ftp.cwd(f"/{REMOTE_DIR}/tmp")
        with open("restart_trigger.txt", "w") as f_tmp:
            f_tmp.write("restart")
        with open("restart_trigger.txt", "rb") as f_tmp:
            ftp.storbinary("STOR restart.txt", f_tmp)
        os.remove("restart_trigger.txt")
        print("🔄 Touched tmp/restart.txt to restart Hostinger Node.js process!")
    except Exception as e:
        print(f"Note on restart trigger: {e}")

    try:
        ftp.quit()
    except Exception:
        pass

    print(f"🎉 API Deployment completed! {file_count} files successfully uploaded to https://api.horecafrica.org")

if __name__ == "__main__":
    deploy()
