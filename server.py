#!/usr/bin/env python3

from http.server import HTTPServer, SimpleHTTPRequestHandler

home = '''
<!DOCTYPE html>
<html>
<head>
    <script type="module" src="main.js"></script>
</head>
</html>
'''

class HTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path =='/':
            self._send_str_content(home, 'text/html')
        else:
            super().do_GET()

    def _send_str_content(self, s, content_type):
        self.send_response(200)
        self.send_header('Content-Type', f'{content_type};charset=utf-8')
        self.end_headers()

        self.wfile.write(s.encode('UTF-8'))


PORT = 8001
httpd = HTTPServer(('', PORT), HTTPRequestHandler)
print(f'serving from http://localhost:{PORT}/')
httpd.serve_forever()
