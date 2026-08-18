#!/usr/bin/env python3
"""tools/dav-stub.py —— 本地 WebDAV 替身，用来在没有真 NAS 的情况下验证同步的写入链路。

为什么需要它：预览用的 python3 -m http.server 对 PUT 直接返 501，
所以上传那条路一直没法在本地跑通。这个替身实现了 PUT / GET / OPTIONS(CORS 预检)
/ PROPFIND / Basic 认证，并且可以注入故障，用来验证失败时 Navi 会不会说谎。

    python3 tools/dav-stub.py 8788

然后在 Navi 里新建一个 WebDAV Profile：
    地址 http://127.0.0.1:8788/bookmarks.json   用户 navi   密码 s3cret

故障注入（浏览器里或 curl 都行）：
    /__ctl?act=fail&mode=401        上传返 401
    /__ctl?act=fail&mode=500        服务器错误
    /__ctl?act=fail&mode=readonly   403 只读
    /__ctl?act=fail&mode=authoptions 预检也要求认证（很多反代的默认行为）
    /__ctl?act=fail&mode=nocors     完全不返回 CORS 头
    /__ctl?act=fail&mode=html       GET 返回 200 的 HTML 登录页（反代常见行为）
    /__ctl?act=fail&mode=redirect   PUT 被 302 重定向到登录页
    /__ctl?act=fail&mode=hang       永不响应（验证超时处理）
    /__ctl?act=fail&mode=           复位
    /__ctl?act=poison               模拟另一台设备改了远端（用来触发冲突）
    /__ctl?act=corrupt              远端内容损坏
    /__ctl?act=reset                清空存储与请求记录
    /__ctl?act=view                 查看收到过的请求序列
"""
import base64, json, os, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

STORE = {}                      # path -> bytes
STATE = {"fail": None, "user": "navi", "pass": "s3cret", "requests": []}
LOCK = threading.Lock()

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass

    def _cors(self):
        o = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", o)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS,PROPFIND,DELETE,HEAD")
        self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type,Depth")
        self.send_header("Access-Control-Expose-Headers", "ETag,Last-Modified")

    def _auth_ok(self):
        if not STATE["user"]:
            return True
        h = self.headers.get("Authorization", "")
        if not h.startswith("Basic "):
            return False
        try:
            raw = base64.b64decode(h[6:]).decode("utf-8")
        except Exception:
            return False
        return raw == STATE["user"] + ":" + STATE["pass"]

    def _record(self, method):
        with LOCK:
            STATE["requests"].append({
                "method": method, "path": self.path,
                "auth": bool(self.headers.get("Authorization")),
                "ctype": self.headers.get("Content-Type", ""),
            })

    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    # ---- 控制接口：注入故障、查看请求记录 ----
    def _ctl(self):
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        params = dict(p.split("=", 1) for p in q.split("&") if "=" in p)
        act = params.get("act", "")
        with LOCK:
            if act == "fail":     STATE["fail"] = params.get("mode") or None
            elif act == "reset":  STATE["fail"] = None; STATE["requests"] = []; STORE.clear()
            elif act == "poison":                      # 模拟"别的设备改过远端"
                cur = json.loads(STORE.get("/bookmarks.json", b"{}").decode("utf-8") or "{}")
                cur.setdefault("bookmarks", []).append(
                    {"id": "remote-x", "title": "远端新增的书签", "url": "https://remote-only.example/x",
                     "category": "Uncategorized", "description": "", "tags": []})
                STORE["/bookmarks.json"] = json.dumps(cur).encode("utf-8")
            elif act == "corrupt": STORE["/bookmarks.json"] = b"<<< not json >>>"
            body = json.dumps({"fail": STATE["fail"], "requests": STATE["requests"],
                               "stored": {k: len(v) for k, v in STORE.items()}}).encode("utf-8")
        self._send(200, body, "application/json")

    def do_OPTIONS(self):
        self._record("OPTIONS")
        if STATE["fail"] == "authoptions":       # 模拟"反代要求预检也带认证"的 NAS
            self.send_response(401); self._cors()
            self.send_header("Content-Length", "0"); self.end_headers(); return
        if STATE["fail"] == "nocors":            # 模拟完全没配 CORS
            self.send_response(204)
            self.send_header("Content-Length", "0"); self.end_headers(); return
        self.send_response(204); self._cors()
        self.send_header("Content-Length", "0"); self.end_headers()

    def do_GET(self):
        if self.path.startswith("/__ctl"): return self._ctl()
        self._record("GET")
        if STATE["fail"] == "500": return self._send(500, b"boom")
        if STATE["fail"] == "hang":                      # 永不响应，用来验证有没有超时
            import time; time.sleep(600); return
        if STATE["fail"] == "html":                      # 反代把未登录请求换成 200 的登录页
            page = (b"<!doctype html><html><head><title>DSM Login</title></head><body>"
                    b"<h1>Sign in</h1><a href=\"https://www.synology.com/support\">Support</a>"
                    b"<a href=\"https://account.synology.com/reset\">Forgot password</a>"
                    b"<form><input name=user><input name=pass type=password></form></body></html>")
            return self._send(200, page, "text/html; charset=utf-8")
        if not self._auth_ok():
            self.send_response(401); self._cors()
            self.send_header("WWW-Authenticate", 'Basic realm="navi"')
            self.send_header("Content-Length", "0"); self.end_headers(); return
        p = self.path.split("?")[0]
        if p == "/login.html":
            return self._send(200, b"<html><body>Please sign in</body></html>", "text/html; charset=utf-8")
        if p not in STORE: return self._send(404, b"not found")
        self._send(200, STORE[p], "application/json")

    def do_PUT(self):
        self._record("PUT")
        if STATE["fail"] == "hang":
            import time; time.sleep(600); return
        if STATE["fail"] == "redirect":                  # PUT 被重定向到登录页
            self.send_response(302); self._cors()
            self.send_header("Location", "/login.html")
            self.send_header("Content-Length", "0"); self.end_headers(); return
        if STATE["fail"] == "401" or not self._auth_ok():
            self.send_response(401); self._cors()
            self.send_header("WWW-Authenticate", 'Basic realm="navi"')
            self.send_header("Content-Length", "0"); self.end_headers(); return
        if STATE["fail"] == "500":     return self._send(500, b"boom")
        if STATE["fail"] == "readonly": return self._send(403, b"read-only")
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n)
        with LOCK: STORE[self.path.split("?")[0]] = data
        self._send(201, b"created")

    def do_PROPFIND(self):
        self._record("PROPFIND")
        self._send(207, b'<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"></D:multistatus>',
                   "application/xml; charset=utf-8")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
