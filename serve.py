"""Local server for playtesting (test.html). Same as `python -m http.server`,
but tells the browser never to cache, so edits to the .js files show up on reload.
Usage: python serve.py   then open http://localhost:8000/test.html"""
import functools
import http.server
import os

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCache, directory=here)
    print('Serving on http://localhost:8000/test.html  (Ctrl+C to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8000), handler).serve_forever()
