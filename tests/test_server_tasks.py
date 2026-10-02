import importlib.util, json, pathlib, tempfile, threading, unittest, urllib.request, urllib.error
from unittest.mock import patch
from http.server import ThreadingHTTPServer
spec=importlib.util.spec_from_file_location("bridge",pathlib.Path(__file__).parents[1]/"scripts/server-diagnostic-bridge.py")
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
class TaskTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.db=str(pathlib.Path(self.tmp.name)/"tasks.sqlite3")
        self.store=bridge.TaskStore(self.db)
        self.server=ThreadingHTTPServer(("127.0.0.1",0),bridge.make_handler("t"*32,self.store))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url="http://127.0.0.1:"+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()
    def request(self,path,data=None,auth=True):
        req=urllib.request.Request(self.url+path,data=json.dumps(data).encode() if data is not None else None,
            headers={"Authorization":"Bearer "+"t"*32} if auth else {})
        with urllib.request.urlopen(req) as r:return json.load(r)
    def test_auth_on_task_and_receipt(self):
        for path,data in [("/v1/tasks",{"task":"server_verify","idempotency_key":"x"}),("/v1/receipts/x",None)]:
            with self.assertRaises(urllib.error.HTTPError) as e:self.request(path,data,False)
            self.assertEqual(e.exception.code,401)
    def test_execute_replay_and_restart_receipt(self):
        task={"task":"server_verify","idempotency_key":"x"}
        with patch.object(bridge,"run_check",side_effect=lambda name:{"check":name,"passed":True}) as run:
            receipt=self.request("/v1/tasks",task);self.assertEqual(receipt["status"],"completed")
            replay=self.request("/v1/tasks",task);self.assertTrue(replay["replayed"]);self.assertEqual(run.call_count,6)
        self.assertEqual(bridge.TaskStore(self.db).get(receipt["receipt_id"])["status"],"completed")
        self.assertEqual(self.request("/v1/receipts/"+receipt["receipt_id"])["receipt_id"],receipt["receipt_id"])
    def test_rejects_arbitrary_execution(self):
        for task in [{"task":"shell","idempotency_key":"x"},{"task":"server_verify","idempotency_key":"x","command":"id"}]:
            with self.assertRaises(urllib.error.HTTPError) as e:self.request("/v1/tasks",task)
            self.assertEqual(e.exception.code,400)
    def test_concurrent_claim_executes_once(self):
        entered=threading.Event();release=threading.Event()
        def check(name):
            entered.set();release.wait(2);return {"check":name,"passed":True}
        task={"task":"server_verify","idempotency_key":"concurrent"}
        with patch.object(bridge,"run_check",side_effect=check) as run:
            thread=threading.Thread(target=lambda:self.store.submit(task));thread.start();entered.wait(2)
            receipt,replayed=self.store.submit(task)
            self.assertTrue(replayed);self.assertEqual(receipt["status"],"running")
            release.set();thread.join();self.assertEqual(run.call_count,6)
    def test_failure_is_durable(self):
        with patch.object(bridge,"run_check",return_value={"passed":False}):
            receipt,_=self.store.submit({"task":"server_verify","idempotency_key":"fail"})
        self.assertEqual(bridge.TaskStore(self.db).get(receipt["receipt_id"])["status"],"failed")
