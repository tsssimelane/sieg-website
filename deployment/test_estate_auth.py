import io,json,tempfile,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from estate_auth import EstateAuth
class AuthTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.auth=EstateAuth(lambda e,s:[],self.tmp.name+'/accounts.db','https://siege.test',['admin@example.com'])
 def tearDown(self):self.tmp.cleanup()
 def call(self,path,body=None,cookie='',origin='https://siege.test'):
  raw=json.dumps(body or {}).encode();result={}
  def start(status,headers):result.update(status=int(status[:3]),headers=dict(headers))
  output=self.auth({'PATH_INFO':'/api/property/'+path,'REQUEST_METHOD':'GET' if body is None else 'POST','HTTP_ORIGIN':origin,'HTTP_COOKIE':cookie,'REMOTE_ADDR':'test','CONTENT_LENGTH':str(len(raw)),'wsgi.input':io.BytesIO(raw)},start)
  return result,json.loads(b''.join(output))
 def test_flow(self):
  data=dict(email='client@example.com',password='a-strong-test-password',name='Client',phone='+268 76000000',consent=True)
  self.assertEqual(self.call('register',data,origin='https://evil.test')[0]['status'],403)
  self.assertEqual(self.call('register',{**data,'email':'admin@example.com'})[0]['status'],403)
  self.assertEqual(self.call('register',data)[0]['status'],201)
  with self.auth.db() as c:self.assertNotIn(data['password'],c.execute('SELECT password FROM estate_users').fetchone()[0])
  self.assertEqual(self.call('login',{**data,'password':'incorrect-password'})[0]['status'],401)
  self.assertEqual(self.call('login',{**data,'role':'Admin'})[0]['status'],403)
  r,d=self.call('login',data);self.assertEqual(r['status'],200);cookie=r['headers']['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('Secure',cookie)
  self.assertTrue(self.call('status',cookie=cookie)[1]['authenticated']);self.assertFalse(self.call('status')[1]['authenticated'])
  self.call('logout',{},cookie);self.assertFalse(self.call('status',cookie=cookie)[1]['authenticated'])
 def test_rate_limit(self):
  for _ in range(5):self.call('login',dict(email='bad@example.com',password='wrong-password-long'))
  self.assertEqual(self.call('login',dict(email='bad@example.com',password='wrong-password-long'))[0]['status'],429)
if __name__=='__main__':unittest.main()
