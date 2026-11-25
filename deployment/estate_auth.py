"""Email/password WSGI middleware for independent SIEG hosting (not Sites).
Wrap the production Python application in EstateAuth; serve behind HTTPS.
"""
import hashlib, hmac, json, secrets, sqlite3, time, re
from http.cookies import SimpleCookie

class EstateAuth:
    def __init__(self, app, database, origin, admin_emails=()):
        if not origin.startswith('https://') or origin.endswith('/'):
            raise ValueError('Provide the exact HTTPS origin without a trailing slash')
        self.app, self.database, self.origin = app, database, origin
        self.admins = {s.strip().lower() for s in admin_emails if s.strip()}
        with self.db() as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS estate_users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS estate_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS estate_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);''')
    def db(self):
        c=sqlite3.connect(self.database, timeout=15);c.row_factory=sqlite3.Row;return c
    @staticmethod
    def password(value, salt=None):
        salt=salt or secrets.token_hex(16)
        digest=hashlib.scrypt(value.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
        return salt+':'+digest
    @staticmethod
    def digest(value):return hashlib.sha256(value.encode()).hexdigest()
    def __call__(self,e,start):
        # Incoming identity headers are never trusted on independent hosting.
        for key in list(e):
            if key.startswith('HTTP_OAI_AUTHENTICATED_'):e.pop(key)
        now=int(time.time());cookies=SimpleCookie()
        try:cookies.load(e.get('HTTP_COOKIE',''))
        except Exception:pass
        token=cookies.get('siege_estate_session');token=token.value if token else ''
        with self.db() as c:
            row=c.execute('SELECT u.* FROM estate_users u JOIN estate_sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',(self.digest(token),now)).fetchone() if token else None
        if row:
            e['siege.user']={k:row[k] for k in ('id','email','name','phone')}
            e['siege.is_admin']=row['email'] in self.admins
        path=e.get('PATH_INFO','');method=e.get('REQUEST_METHOD','GET')
        def reply(data,status=200,cookie=None):
            headers=[('Content-Type','application/json'),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff')]
            if cookie:headers.append(('Set-Cookie',cookie))
            start(str(status)+' '+{200:'OK',201:'Created',400:'Bad Request',401:'Unauthorized',403:'Forbidden',409:'Conflict',413:'Payload Too Large',429:'Too Many Requests',405:'Method Not Allowed'}.get(status,'Error'),headers)
            return [json.dumps(data).encode()]
        def session(uid):
            value=secrets.token_urlsafe(32)
            with self.db() as c:
                c.execute('DELETE FROM estate_sessions WHERE expires<=?',(now,))
                if token:c.execute('DELETE FROM estate_sessions WHERE token=?',(self.digest(token),))
                c.execute('INSERT INTO estate_sessions VALUES(?,?,?)',(self.digest(value),uid,now+28800))
            return 'siege_estate_session='+value+'; Path=/; Max-Age=28800; Secure; HttpOnly; SameSite=Lax'
        if path=='/api/property/status' and method=='GET':
            profile={k:row[k] for k in ('name','email','phone')} if row else None
            return reply(dict(available=True,authMode='email-password',authenticated=bool(row),registered=bool(row),profile=profile,email=row['email'] if row else None,isAdmin=bool(row and row['email'] in self.admins)))
        if path not in ('/api/property/register','/api/property/login','/api/property/logout'):return self.app(e,start)
        if method!='POST':return reply({'error':'Use POST.'},405)
        if e.get('HTTP_ORIGIN')!=self.origin:return reply({'error':'Origin not allowed.'},403)
        try:
            size=int(e.get('CONTENT_LENGTH') or 0)
            if size<=0 or size>16384:return reply({'error':'Invalid request size.'},413)
            b=json.loads(e['wsgi.input'].read(size))
            if not isinstance(b,dict):raise ValueError()
        except Exception:return reply({'error':'Invalid request.'},400)
        if path.endswith('/logout'):
            with self.db() as c:c.execute('DELETE FROM estate_sessions WHERE token=?',(self.digest(token),))
            return reply({'signedOut':True},cookie='siege_estate_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax')
        email=str(b.get('email','')).strip().lower();password=b.get('password','')
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>200 or not isinstance(password,str) or not 12<=len(password)<=128:
            return reply({'error':'Enter a valid email and a password of 12–128 characters.'},400)
        key=self.digest(e.get('REMOTE_ADDR','')+'|'+email)
        with self.db() as c:
            c.execute('DELETE FROM estate_attempts WHERE expires<=?',(now,))
            attempt=c.execute('SELECT count FROM estate_attempts WHERE key=?',(key,)).fetchone()
            if attempt and attempt['count']>=5:return reply({'error':'Too many attempts. Try again in 15 minutes.'},429)
            c.execute('INSERT INTO estate_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,now+900))
            user=c.execute('SELECT * FROM estate_users WHERE email=?',(email,)).fetchone()
        if path.endswith('/register'):
            name=str(b.get('name','')).strip();phone=str(b.get('phone','')).strip()
            if b.get('consent') is not True or not 1<=len(name)<=100 or not re.fullmatch(r'\+[0-9 ()-]{6,25}',phone):return reply({'error':'Provide your name, international phone and consent.'},400)
            # Admin status is determined only by the server allowlist after login.
            if b.get('role')=='Admin' or email in self.admins:return reply({'error':'Admin self-registration is not available.'},403)
            if user:return reply({'error':'Unable to register. Try signing in or contact SIEG.'},409)
            uid=secrets.token_hex(16)
            try:
                with self.db() as c:c.execute('INSERT INTO estate_users VALUES(?,?,?,?,?,?)',(uid,email,name,phone,self.password(password),now))
            except sqlite3.IntegrityError:return reply({'error':'Unable to register. Try signing in.'},409)
            return reply({'registered':True,'message':'Account created. Sign in with your email and password.'},201)
        encoded=user['password'] if user else self.password('dummy-password-value')
        valid=hmac.compare_digest(self.password(password,encoded.split(':')[0]),encoded)
        if not user or not valid:return reply({'error':'Email or password is incorrect.'},401)
        if b.get('role')=='Admin' and email not in self.admins:return reply({'error':'Administrator access required.'},403)
        with self.db() as c:c.execute('DELETE FROM estate_attempts WHERE key=?',(key,))
        return reply({'authenticated':True,'role':'Admin' if b.get('role')=='Admin' else 'Client'},cookie=session(user['id']))
