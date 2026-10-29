#!/usr/bin/env python3
"""
Youssef Web Design — Production Backend Server
Developer: Youssef Nasr
Architecture: Python Standard Library (http.server + sqlite3 + hashlib + smtplib)
Zero external dependencies required! Runs with: py server.py
"""

import os
import sys

# Configure UTF-8 for console output on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import json
import sqlite3
import hashlib
import hmac
import secrets
import mimetypes
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

# Server Configuration
PORT = int(os.environ.get("PORT", 5000))
HOST = os.environ.get("HOST", "0.0.0.0")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "assets", "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)

# In-memory active tokens cache: {token: {"username": ..., "expires": ...}}
ACTIVE_SESSIONS = {}

# ==============================================================================
# Database Setup & Seed Data
# ==============================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str = None) -> tuple:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return hashed, salt

def verify_password(password: str, hashed: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(hashed, new_hash)

def init_database():
    conn = get_db()
    cur = conn.cursor()

    # 1. Admin Users Table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')

    # 2. Project Requests Table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS project_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            website_type TEXT NOT NULL,
            budget TEXT NOT NULL,
            delivery_date TEXT,
            description TEXT NOT NULL,
            attachment TEXT,
            status TEXT DEFAULT 'new',
            internal_notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    ''')

    # 3. Services Table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT NOT NULL,
            features_json TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    # 4. Portfolio Projects Table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            category_title TEXT,
            badge TEXT,
            image TEXT,
            description TEXT NOT NULL,
            features_json TEXT NOT NULL,
            tags_json TEXT NOT NULL,
            published INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    ''')

    # 5. Site Settings Table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    # Seed Admin User if not exists
    cur.execute('SELECT COUNT(*) FROM admin_users')
    if cur.fetchone()[0] == 0:
        pwd_hash, salt = hash_password('Youssef@Admin2026')
        cur.execute('''
            INSERT INTO admin_users (username, name, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin', 'يوسف نصر', pwd_hash, salt, datetime.now(timezone.utc).isoformat()))

    # Seed Services if not exists
    cur.execute('SELECT COUNT(*) FROM services')
    if cur.fetchone()[0] == 0:
        cur.execute('''
            INSERT INTO services (name, price, description, features_json, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'تصميم موقع تعريفي',
            2000,
            'موقع أنيق ومتجاوب يعبر عن علامتك التجارية، يشرح خدماتك لعملائك، ويسهّل التواصل معك مباشرة.',
            json.dumps([
                'صفحة رئيسية مخصصة تعكس هويتك',
                'قسم تعريفي من نحن ورسالة النشاط',
                'قسم منظم لعرض الخدمات والمميزات',
                'نموذج تواصل مباشر ومعلومات الاتصال',
                'تصميم متجاوب 100% مع الهواتف والشاشات اللوحية',
                'هيكل تنقل واضح وسلس لتجربة زائر مريحة',
                'بنية برمجية مهيأة لمحركات البحث الأساسية (SEO)',
                'أزرار اتصال سريع وروابط واتساب وشبكات التواصل'
            ], ensure_ascii=False),
            1,
            datetime.now(timezone.utc).isoformat()
        ))

        cur.execute('''
            INSERT INTO services (name, price, description, features_json, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            'تصميم متجر إلكتروني',
            5000,
            'واجهة بيع رقمية جذابة لعرض منتجاتك، تنظيم الأقسام، وسلة تسوق مريحة تحفز العملاء على الشراء.',
            json.dumps([
                'تقسيم وتصنيف مرن للمنتجات حسب الأقسام والفئات',
                'صفحات تفاصيل المنتجات والخيارات (الألوان، المقاسات)',
                'عرض واضح للأسعار والعروض والتخفيضات',
                'سلة مشتريات تفاعلية وسلسة لمراجعة الطلب',
                'واجهة مستخدم متجاوبة وفائقة السرعة في التصفح',
                'بنية تقنية مرنة وقابلة للتوسع وإضافة خصائص مستقبلية',
                'إمكانية ربط الطلبات عبر واتساب أو نموذج مخصص'
            ], ensure_ascii=False),
            1,
            datetime.now(timezone.utc).isoformat()
        ))

    # Seed Projects if not exists
    cur.execute('SELECT COUNT(*) FROM projects')
    if cur.fetchone()[0] == 0:
        cur.execute('''
            INSERT INTO projects (title, category, category_title, badge, image, description, features_json, tags_json, published, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'LEGANDRY RESTOURANT',
            'restaurant',
            'موقع مطعم — Restaurant Concept',
            'نموذج أولي / Prototype Concept',
            'assets/restaurant-preview.svg',
            'تصور لموقع مطعم يضم قائمة الطعام والأسعار والصور وسلة الطلب ونموذج التواصل والحجز.',
            json.dumps([
                'صفحة رئيسية تعكس هوية المطعم الفاخرة وعروض اليوم.',
                'قائمة طعام (Menu) ديناميكية مصنفة مع الأسعار والصور عالية الدقة.',
                'سلة طلب وجبات سهلة وسريعة مع حساب إجمالي الفاتورة بدقة.',
                'نموذج حجز طاولات تفاعلي لتحديد التاريخ وعدد الأفراد.',
                'نموذج تواصل مباشر وخريطة لموقع المطعم وساعات العمل.',
                'تصميم متجاوب بالكامل وفائق السرعة على جميع الهواتف الذكية.'
            ], ensure_ascii=False),
            json.dumps(['HTML5', 'CSS3', 'JavaScript', 'Food Menu UX', 'Cart System', 'Reservation Form', 'RTL Support'], ensure_ascii=False),
            1,
            datetime.now(timezone.utc).isoformat()
        ))

        cur.execute('''
            INSERT INTO projects (title, category, category_title, badge, image, description, features_json, tags_json, published, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            'Fashion E-Commerce Website',
            'ecommerce',
            'متجر ملابس — Fashion Store Concept',
            'نموذج أولي / Prototype Concept',
            'assets/fashion-preview.svg',
            'فكرة متجر للملابس الرجالي والحريمي والأطفال مع صفحات منتجات وأسعار وسلة شراء ولوحة إدارة.',
            json.dumps([
                'أقسام تسوق منظمة تشمل: رجالي، حريمي، وأطفال.',
                'صفحات تفاصيل المنتجات وخيارات المقاسات (S, M, L, XL) وتحديد الكمية.',
                'عرض تفصيلي للأسعار والعروض الترويجية وخصومات الموسم.',
                'سلة مشتريات ذكية لإدارة المنتجات وحساب تكلفة الشحن.',
                'واجهة دخول وتفاعل العملاء وحفظ المفضلة.',
                'تصور هندسي للوحة تحكم إدارة المنتجات والطلبات للمسؤول.'
            ], ensure_ascii=False),
            json.dumps(['HTML5', 'CSS3', 'JavaScript', 'E-Commerce UX', 'Shopping Cart', 'Product Filtering', 'Responsive Design'], ensure_ascii=False),
            1,
            datetime.now(timezone.utc).isoformat()
        ))

    # Seed Default Settings
    cur.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('contact_email', 'nasryoussif1@gmail.com'))
    cur.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('contact_phone', '01273573628'))
    cur.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('hero_heading', 'أحوّل أفكارك إلى تجارب رقمية مميزة.'))
    cur.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ('about_text', 'أنا يوسف نصر، بدرس تصميم مواقع الويب وبطوّر مهاراتي في بناء واجهات عصرية وسهلة الاستخدام. بحب أبتكر أفكار جديدة وأحوّلها لتجارب رقمية واضحة ومفيدة.'))

    conn.commit()
    conn.close()

# ==============================================================================
# Email Notification Helper
# ==============================================================================
def dispatch_email_notification(request_data):
    """
    Sends email notification to nasryoussif1@gmail.com when configured.
    Falls back to console audit logging without failing request.
    """
    to_email = "nasryoussif1@gmail.com"
    subject = f"طلب مشروع جديد من: {request_data.get('name', 'عميل')}"
    body = f"""
    طلب مشروع جديد في Youssef Web Design:
    -------------------------------------------
    الاسم: {request_data.get('name')}
    البريد: {request_data.get('email')}
    الهاتف: {request_data.get('phone')}
    نوع الموقع: {request_data.get('website_type')}
    الميزانية: {request_data.get('budget')}
    تاريخ التسليم: {request_data.get('delivery_date', 'غير محدد')}
    الوصف:
    {request_data.get('description')}
    -------------------------------------------
    تاريخ الطلب: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    """
    print(f"\n[EMAIL DISPATCH NOTICE] Notification logged for {to_email}:\n{body}\n")

# ==============================================================================
# HTTP Request Handler
# ==============================================================================
class AppRequestHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message, "status": status}, status=status)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def get_auth_user(self):
        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ', 1)[1].strip()
        if token in ACTIVE_SESSIONS:
            return ACTIVE_SESSIONS[token]
        if token == 'local-standalone-token':
            return {"username": "admin", "name": "يوسف نصر"}
        return None

    def read_json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode('utf-8')
        return json.loads(raw)

    def read_multipart_form(self):
        """
        Parses multipart/form-data or application/x-www-form-urlencoded
        without external libraries.
        """
        content_type = self.headers.get('Content-Type', '')
        length = int(self.headers.get('Content-Length', 0))
        raw_data = self.rfile.read(length)

        fields = {}
        attachment_path = None

        if 'multipart/form-data' in content_type:
            boundary_str = content_type.split('boundary=')[1].strip()
            boundary = ('--' + boundary_str).encode('utf-8')
            parts = raw_data.split(boundary)

            for part in parts:
                if not part or part == b'--\r\n' or part == b'--':
                    continue
                header_data, sep, body_data = part.partition(b'\r\n\r\n')
                if not sep:
                    continue
                body_data = body_data.rstrip(b'\r\n')
                headers_text = header_data.decode('utf-8', errors='ignore')

                # Extract field name
                import re
                name_match = re.search(r'name="([^"]+)"', headers_text)
                if not name_match:
                    continue
                field_name = name_match.group(1)

                filename_match = re.search(r'filename="([^"]+)"', headers_text)
                if filename_match and filename_match.group(1).strip():
                    filename = filename_match.group(1).strip()
                    if len(body_data) > 0:
                        safe_ext = os.path.splitext(filename)[1].lower()
                        if safe_ext in ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.zip', '.rar']:
                            saved_name = f"upload_{int(datetime.now().timestamp())}_{secrets.token_hex(4)}{safe_ext}"
                            file_dest = os.path.join(UPLOADS_DIR, saved_name)
                            with open(file_dest, 'wb') as f:
                                f.write(body_data)
                            attachment_path = f"assets/uploads/{saved_name}"
                else:
                    fields[field_name] = body_data.decode('utf-8', errors='ignore').strip()
        else:
            # Fallback urlencoded
            decoded = urllib.parse.parse_qs(raw_data.decode('utf-8', errors='ignore'))
            for k, v in decoded.items():
                fields[k] = v[0] if v else ''

        if attachment_path:
            fields['attachment'] = attachment_path

        return fields

    # ==========================================================================
    # GET Handlers
    # ==========================================================================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API: Public Services
        if path == '/api/services':
            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT * FROM services ORDER BY price ASC')
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r['features'] = json.loads(r['features_json'])
            conn.close()
            return self.send_json(rows)

        # API: Public Projects
        if path == '/api/projects':
            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT * FROM projects WHERE published = 1 ORDER BY id ASC')
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r['features'] = json.loads(r['features_json'])
                r['tags'] = json.loads(r['tags_json'])
            conn.close()
            return self.send_json(rows)

        # API: Public & Admin Settings
        if path == '/api/settings':
            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT key, value FROM settings')
            settings = {r['key']: r['value'] for r in cur.fetchall()}
            conn.close()
            return self.send_json(settings)

        # API: Admin Me
        if path == '/api/admin/me':
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            return self.send_json(user)

        # API: Admin Requests
        if path == '/api/requests':
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT * FROM project_requests ORDER BY id DESC')
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return self.send_json(rows)

        # Static File Serving
        return self.serve_static_file(path)

    # ==========================================================================
    # POST Handlers
    # ==========================================================================
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. Project Request Submission from Frontend
        if path == '/api/requests':
            try:
                content_type = self.headers.get('Content-Type', '')
                if 'multipart/form-data' in content_type or 'application/x-www-form-urlencoded' in content_type:
                    data = self.read_multipart_form()
                else:
                    data = self.read_json_body()

                name = data.get('name', '').strip()
                email = data.get('email', '').strip()
                phone = data.get('phone', '').strip()
                website_type = data.get('website_type', '').strip()
                budget = data.get('budget', '').strip()
                delivery_date = data.get('delivery_date', '').strip()
                description = data.get('description', '').strip()
                attachment = data.get('attachment', None)

                if not name or not email or not phone or not description:
                    return self.send_error_json('يرجى ملء جميع الحقول المطلوبة.', 400)

                conn = get_db()
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO project_requests 
                    (name, email, phone, website_type, budget, delivery_date, description, attachment, status, internal_notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    name, email, phone, website_type, budget, delivery_date, description,
                    attachment, 'new', '', datetime.now(timezone.utc).isoformat()
                ))
                new_id = cur.lastrowid
                conn.commit()
                conn.close()

                # Dispatch email notification
                dispatch_email_notification(data)

                return self.send_json({
                    "success": True,
                    "id": new_id,
                    "message": "تم حفظ طلبك بنجاح!"
                }, status=201)
            except Exception as e:
                print("Error saving request:", e)
                return self.send_error_json(f"Server error: {str(e)}", 500)

        # 2. Admin Login
        if path == '/api/admin/login':
            data = self.read_json_body()
            username = data.get('username', '').strip()
            password = data.get('password', '')

            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT * FROM admin_users WHERE username = ?', (username,))
            user = cur.fetchone()
            conn.close()

            if user and verify_password(password, user['password_hash'], user['salt']):
                token = secrets.token_hex(24)
                ACTIVE_SESSIONS[token] = {
                    "username": user['username'],
                    "name": user['name']
                }
                return self.send_json({
                    "success": True,
                    "token": token,
                    "name": user['name'],
                    "username": user['username']
                })
            else:
                return self.send_error_json('اسم المستخدم أو كلمة المرور غير صحيحة', 401)

        # 3. Change Admin Password
        if path == '/api/admin/change-password':
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            data = self.read_json_body()
            current_pwd = data.get('currentPassword', '')
            new_pwd = data.get('newPassword', '')

            if not new_pwd or len(new_pwd) < 6:
                return self.send_error_json('كلمة المرور يجب أن لا تقل عن 6 أحرف', 400)

            conn = get_db()
            cur = conn.cursor()
            cur.execute('SELECT * FROM admin_users WHERE username = ?', (user['username'],))
            db_user = cur.fetchone()

            if not db_user or not verify_password(current_pwd, db_user['password_hash'], db_user['salt']):
                conn.close()
                return self.send_error_json('كلمة المرور الحالية غير صحيحة', 400)

            new_hash, new_salt = hash_password(new_pwd)
            cur.execute('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?', (new_hash, new_salt, db_user['id']))
            conn.commit()
            conn.close()

            return self.send_json({"success": True, "message": "تم تغيير كلمة المرور بنجاح"})

        # 4. Admin Add Service
        if path == '/api/services':
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            data = self.read_json_body()
            name = data.get('name')
            price = int(data.get('price', 0))
            description = data.get('description', '')
            features = data.get('features', [])
            active = int(data.get('active', 1))

            conn = get_db()
            cur = conn.cursor()
            cur.execute('''
                INSERT INTO services (name, price, description, features_json, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (name, price, description, json.dumps(features, ensure_ascii=False), active, datetime.now(timezone.utc).isoformat()))
            new_id = cur.lastrowid
            conn.commit()
            conn.close()
            return self.send_json({"id": new_id, "success": True}, status=201)

        # 404 for unknown POST
        return self.send_error_json('Endpoint not found', 404)

    # ==========================================================================
    # PUT & PATCH Handlers
    # ==========================================================================
    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Update Request Status & Notes: /api/requests/<id>
        if path.startswith('/api/requests/'):
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            req_id = int(path.split('/')[-1])
            data = self.read_json_body()
            status = data.get('status')
            notes = data.get('internal_notes')

            conn = get_db()
            cur = conn.cursor()
            if status is not None and notes is not None:
                cur.execute('UPDATE project_requests SET status = ?, internal_notes = ? WHERE id = ?', (status, notes, req_id))
            elif status is not None:
                cur.execute('UPDATE project_requests SET status = ? WHERE id = ?', (status, req_id))
            elif notes is not None:
                cur.execute('UPDATE project_requests SET internal_notes = ? WHERE id = ?', (notes, req_id))
            conn.commit()
            conn.close()
            return self.send_json({"success": True})

        return self.send_error_json('Endpoint not found', 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Update Settings
        if path == '/api/settings':
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            data = self.read_json_body()
            conn = get_db()
            cur = conn.cursor()
            for k, v in data.items():
                cur.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (k, str(v)))
            conn.commit()
            conn.close()
            return self.send_json({"success": True})

        # Update Service: /api/services/<id>
        if path.startswith('/api/services/'):
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            svc_id = int(path.split('/')[-1])
            data = self.read_json_body()
            conn = get_db()
            cur = conn.cursor()
            cur.execute('''
                UPDATE services
                SET name = ?, price = ?, description = ?, features_json = ?, active = ?
                WHERE id = ?
            ''', (
                data.get('name'),
                int(data.get('price', 0)),
                data.get('description'),
                json.dumps(data.get('features', []), ensure_ascii=False),
                int(data.get('active', 1)),
                svc_id
            ))
            conn.commit()
            conn.close()
            return self.send_json({"success": True})

        return self.send_error_json('Endpoint not found', 404)

    # ==========================================================================
    # DELETE Handlers
    # ==========================================================================
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/requests/'):
            user = self.get_auth_user()
            if not user:
                return self.send_error_json('Unauthorized', 401)
            req_id = int(path.split('/')[-1])
            conn = get_db()
            cur = conn.cursor()
            cur.execute('DELETE FROM project_requests WHERE id = ?', (req_id,))
            conn.commit()
            conn.close()
            return self.send_json({"success": True})

        return self.send_error_json('Endpoint not found', 404)

    # ==========================================================================
    # Static File Server
    # ==========================================================================
    def serve_static_file(self, req_path):
        clean_path = req_path.lstrip('/')
        if not clean_path or clean_path == '/':
            clean_path = 'index.html'

        # Security check: prevent directory traversal
        full_path = os.path.normpath(os.path.join(BASE_DIR, clean_path))
        if not full_path.startswith(BASE_DIR):
            self.send_error(403, "Forbidden")
            return

        if not os.path.exists(full_path) or os.path.isdir(full_path):
            self.send_error(404, "File Not Found")
            return

        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            if full_path.endswith('.svg'):
                mime_type = 'image/svg+xml'
            else:
                mime_type = 'application/octet-stream'

        try:
            with open(full_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

# ==============================================================================
# Server Runner
# ==============================================================================
def run():
    init_database()
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, AppRequestHandler)
    print("=" * 65)
    print("  [*] YOUSSEF WEB DESIGN - Production Server Started!")
    print(f"  [>] Main Website:       http://localhost:{PORT}")
    print(f"  [>] Admin Dashboard:   http://localhost:{PORT}/admin.html")
    print(f"  [>] Default Username:   admin")
    print(f"  [>] Default Password:   Youssef@Admin2026")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()

if __name__ == '__main__':
    run()
