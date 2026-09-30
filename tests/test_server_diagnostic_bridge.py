import importlib.util, pathlib, threading, unittest, urllib.request, urllib.error
from unittest.mock import patch
from http.server import ThreadingHTTPServer
spec = importlib.util.spec_from_file_location("bridge", pathlib.Path(__file__).parents[1] / "scripts/server-diagnostic-bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.make_handler("t" * 32))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = "http://127.0.0.1:" + str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
    def test_denies_unauthenticated(self):
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(self.url + "/v1/server/verify")
        self.assertEqual(e.exception.code, 401)
    def test_authenticated_receipt(self):
        with patch.object(bridge, "run_check", side_effect=lambda name: {"check": name, "passed": True}):
            req = urllib.request.Request(self.url + "/v1/server/verify", headers={"Authorization": "Bearer " + "t"*32})
            with urllib.request.urlopen(req) as r:
                import json
                data = json.load(r)
            self.assertEqual(data["status"], "passed")
            self.assertFalse(data["mission_execution_verified"])
            self.assertEqual(len(data["checks"]), 6)
    def test_rejects_commands(self):
        with self.assertRaises(ValueError): bridge.run_check("hostname; id")
        req = urllib.request.Request(self.url, data=b"{}", headers={"Authorization": "Bearer " + "t"*32})
        with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req)
        self.assertEqual(e.exception.code, 405)
if __name__ == "__main__": unittest.main()
