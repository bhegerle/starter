#!/usr/bin/env python3

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from json import loads, dumps
from os import getcwd
from pathlib import Path, PurePosixPath

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


    def do_POST(self):
        if self.path in post_map:
            n = int(self.headers.get('content-length'))
            req = loads(self.rfile.read(n))
            res = post_map[self.path](req)
            self._send_str_content(dumps(res), 'application/json')
        else:
            super().do_POST()


    def _send_str_content(self, s, content_type):
        self.send_response(200)
        self.send_header('Content-Type', f'{content_type};charset=utf-8')
        self.end_headers()

        self.wfile.write(s.encode('UTF-8'))


def find(path):
    cwd = Path(getcwd())
    rpath = cwd.joinpath(path).resolve()

    return [str(PurePosixPath(p.relative_to(cwd)))
            for p in rpath.glob('**/*')
            if p.is_file()]

    
post_map = {
    '/find': find
}


PORT = 8001
httpd = ThreadingHTTPServer(('', PORT), HTTPRequestHandler)
print(f'serving from http://localhost:{PORT}/')
httpd.serve_forever()
