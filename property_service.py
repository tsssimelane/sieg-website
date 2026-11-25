"""Python account/listing service: python app.py --build; python property_service.py.
Set PROPERTY_ADMIN_EMAIL and PROPERTY_ADMIN_PASSWORD before starting.
SQLite database stays in PROPERTY_DATA_DIR (default ./property-data). Deploy behind HTTPS for production.
"""
import base64,hashlib,hmac,json,os,re,secrets,sqlite3,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get('PROPERTY_DATA_DIR',str(ROOT/'property-data')));DATA.mkdir(exist_ok=True)
DB=DATA/'accounts.sqlite3';sessions={}
def db():return sqlite3.connect(DB)
with db() as c:
 c.execute('CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, salt TEXT, hash TEXT)')
 c.execute('CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, owner TEXT, data TEXT)')
def digest(password,salt):return hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'dist'),**kw)
 def log_message(self,*args):pass
 def respond(self,status,data,cookie=None):
  body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
  if cookie:self.send_header('Set-Cookie',cookie)
  self.end_headers();self.wfile.write(body)
 def session(self):
  try:cookie=SimpleCookie(self.headers.get('Cookie',''));token=cookie['siege_property'].value;item=sessions.get(token)
  except (KeyError,TypeError):return None
  return item if item and item['expires']>time.time() else None
 def do_GET(self):
  if self.path=='/api/property/status':return self.respond(200,{'available':True})
  if self.path=='/api/property/listings':
   user=self.session()
   if not user:return self.respond(401,{'error':'Login required'})
   with db() as c:rows=c.execute('SELECT data FROM listings' if user['role']=='Admin' else 'SELECT data FROM listings WHERE owner=?',() if user['role']=='Admin' else (user['email'],)).fetchall()
   return self.respond(200,{'listings':[json.loads(x[0]) for x in rows]})
  return super().do_GET()
 def do_POST(self):
  if not self.path.startswith('/api/property/'):return self.respond(404,{'error':'Not found'})
  origin=self.headers.get('Origin','');allowed=os.environ.get('PROPERTY_ALLOWED_ORIGIN','http://'+self.headers.get('Host',''))
  if origin!=allowed:return self.respond(403,{'error':'Origin not allowed'})
  try:
   n=int(self.headers.get('Content-Length','0'))
   if n<1 or n>8000000:raise ValueError()
   data=json.loads(self.rfile.read(n))
   if not isinstance(data,dict):raise ValueError()
  except (ValueError,TypeError):return self.respond(400,{'error':'Invalid input'})
  if self.path in ['/api/property/login','/api/property/register']:
   email=str(data.get('email','')).strip().lower();password=str(data.get('password',''));role=data.get('role','Client')
   if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>200 or len(password)<12 or len(password)>200:return self.respond(400,{'error':'Enter a valid email and a password of at least 12 characters'})
   if self.path.endswith('register'):
    if role!='Client':return self.respond(403,{'error':'Only client registration is available'})
    salt=secrets.token_hex(16)
    try:
     with db() as c:c.execute('INSERT INTO users VALUES(?,?,?)',(email,salt,digest(password,salt)))
    except sqlite3.IntegrityError:return self.respond(409,{'error':'Account already exists'})
   elif role=='Admin':
    admin=os.environ.get('PROPERTY_ADMIN_EMAIL','').lower();secret=os.environ.get('PROPERTY_ADMIN_PASSWORD','')
    if not admin or not secret:return self.respond(503,{'error':'Admin account not configured'})
    if not hmac.compare_digest(email,admin) or not hmac.compare_digest(password,secret):return self.respond(401,{'error':'Login failed'})
   else:
    with db() as c:row=c.execute('SELECT salt,hash FROM users WHERE email=?',(email,)).fetchone()
    if not row or not hmac.compare_digest(digest(password,row[0]),row[1]):return self.respond(401,{'error':'Login failed'})
   token=secrets.token_urlsafe(32);sessions[token]={'email':email,'role':role,'expires':time.time()+28800}
   secure='; Secure' if os.environ.get('PROPERTY_HTTPS')=='1' else ''
   return self.respond(200,{'role':role},'siege_property='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+secure)
  if self.path=='/api/property/listings':
   user=self.session()
   if not user:return self.respond(401,{'error':'Login required'})
   p=data.get('property',{})
   try:
    if not isinstance(p,dict):raise ValueError()
    for key in ['title','city','region','type','description']:
     if not isinstance(p.get(key),str) or len(p[key])>3000:raise ValueError()
    if p['region'] not in ['Hhohho','Manzini','Lubombo','Shiselweni'] or p['type'] not in ['Residential','Commercial','Land','Agricultural']:raise ValueError()
    for key in ['lat','lon','price','area']:
     if not isinstance(p.get(key),(float,int)):raise ValueError()
    if not -90<=p['lat']<=90 or not -180<=p['lon']<=180 or p['price']<0 or p['area']<0:raise ValueError()
    photos=p.get('photos',[])
    if not isinstance(photos,list) or len(photos)>5:raise ValueError()
    for photo in photos:
     if not photo.startswith('data:image/jpeg;base64,') or len(photo)>2000000:raise ValueError()
     raw=base64.b64decode(photo.split(',',1)[1],validate=True)
     if not raw.startswith(b'\xff\xd8'):raise ValueError()
   except (ValueError,TypeError,KeyError,AttributeError):return self.respond(400,{'error':'Invalid property data'})
   p['id']='RECORD-'+secrets.token_hex(8);p['entryRole']=user['role'];p['tenure']='User supplied — unverified'
   with db() as c:c.execute('INSERT INTO listings VALUES(?,?,?)',(p['id'],user['email'],json.dumps(p)))
   return self.respond(201,{'property':p})
  return self.respond(404,{'error':'Not found'})
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('PROPERTY_PORT','8002'))),Handler).serve_forever()
