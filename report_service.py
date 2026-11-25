"""Legacy SMTP endpoints are retired. Reports use /api/reports/ on the hosted Worker.
See REPORT_DELIVERY.md for email and payment configuration. No bank-transfer instructions are sent.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os
class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_response(410); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(json.dumps({'error':'Use the current SIEG report delivery flow at /api/reports/orders.'}).encode())
if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('REPORT_PORT','8001'))),Handler).serve_forever()
