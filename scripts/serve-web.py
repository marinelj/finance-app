#!/usr/bin/env python3
"""Serve the exported SPA with isolation headers and a deep-link fallback."""

import argparse
import json
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def configured_base_path():
    config = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
    value = config.get("expo", {}).get("experiments", {}).get("baseUrl", "")
    return "/" + str(value).strip("/") if value else ""


class FinanceHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory, base_path, **kwargs):
        self.base_path = base_path
        self.directory_path = Path(directory).resolve()
        self.response_cache_control = None
        super().__init__(*args, directory=str(self.directory_path), **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if self.response_cache_control:
            self.send_header("Cache-Control", self.response_cache_control)
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".wasm"):
            return "application/wasm"
        if path.endswith(".webmanifest"):
            return "application/manifest+json"
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def do_GET(self):
        self.serve_app("GET")

    def do_HEAD(self):
        self.serve_app("HEAD")

    def serve_app(self, method):
        self.response_cache_control = None
        request_path = unquote(urlsplit(self.path).path)
        if self.base_path:
            if request_path == self.base_path:
                self.send_response(308)
                self.send_header("Location", self.base_path + "/")
                self.end_headers()
                return
            if not request_path.startswith(self.base_path + "/"):
                self.send_error(404, "Path is outside the configured web base path")
                return
            request_path = request_path[len(self.base_path) :]

        relative = request_path.lstrip("/") or "index.html"
        target = (self.directory_path / relative).resolve()
        if self.directory_path not in target.parents and target != self.directory_path:
            self.send_error(403, "Invalid path")
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            accepts_html = "text/html" in self.headers.get("Accept", "")
            if accepts_html:
                target = self.directory_path / "index.html"
            else:
                self.send_error(404)
                return

        self.path = "/" + target.relative_to(self.directory_path).as_posix()
        if target.name == "sw.js":
            self.response_cache_control = "no-cache"
        elif target.name == "index.html":
            self.response_cache_control = "no-cache"
        if method == "HEAD":
            super().do_HEAD()
        else:
            super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--dist", type=Path, default=ROOT / "dist")
    parser.add_argument("--base-path", default=None, help="Override experiments.baseUrl")
    args = parser.parse_args()
    directory = args.dist.resolve()
    if not (directory / "index.html").is_file():
        parser.error(f"{directory} has no index.html; run npm run web:export first")
    base_path = args.base_path if args.base_path is not None else configured_base_path()
    base_path = "/" + base_path.strip("/") if base_path.strip("/") else ""
    handler = lambda *handler_args, **handler_kwargs: FinanceHandler(
        *handler_args, directory=directory, base_path=base_path, **handler_kwargs
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Finance web export: http://{args.host}:{args.port}{base_path or '/'}")
    print("COOP/COEP headers enabled; SPA deep links fall back to index.html.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
