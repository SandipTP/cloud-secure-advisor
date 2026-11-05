import os
import sys
import json
import io
import unittest

# Add backend to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import app, db, User, Upload, Finding, PasswordResetToken


class CloudSecureAdvisorTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = app.test_client()
        with app.app_context():
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def _register_and_login(self, email="test@example.com", password="password123"):
        self.client.post("/signup", json={"email": email, "password": password})
        res = self.client.post("/login", json={"email": email, "password": password})
        token = res.get_json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_signup_and_login(self):
        res = self.client.post("/signup", json={"email": "alice@example.com", "password": "securepass123"})
        self.assertEqual(res.status_code, 201)

        res2 = self.client.post("/login", json={"email": "alice@example.com", "password": "securepass123"})
        self.assertEqual(res2.status_code, 200)
        self.assertIn("access_token", res2.get_json())

    def test_batch_upload_saves_nist_reference(self):
        headers = self._register_and_login()
        sample_iam = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "*"
                }
            ]
        }
        data = {
            "files": (io.BytesIO(json.dumps(sample_iam).encode("utf-8")), "iam_policy.json")
        }
        res = self.client.post("/upload/batch", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertEqual(res_json["total_files"], 1)
        upload_id = res_json["results"][0]["upload_id"]

        # Check findings saved with nist_reference
        f_res = self.client.get(f"/findings/{upload_id}", headers=headers)
        self.assertEqual(f_res.status_code, 200)
        findings = f_res.get_json()
        self.assertGreater(len(findings), 0)
        for f in findings:
            self.assertTrue(bool(f.get("nist_reference")), f"Missing nist_reference in finding: {f}")

    def test_delete_history(self):
        headers = self._register_and_login()
        data = {
            "files": (io.BytesIO(b'{"Version":"2012-10-17","Statement":[]}'), "empty.json")
        }
        res = self.client.post("/upload/batch", data=data, content_type="multipart/form-data", headers=headers)
        upload_id = res.get_json()["results"][0]["upload_id"]

        # Delete upload
        del_res = self.client.delete(f"/history/{upload_id}", headers=headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.get_json()["message"], "Deleted successfully")

        # Verify not found now
        check_res = self.client.get(f"/findings/{upload_id}", headers=headers)
        self.assertEqual(check_res.status_code, 404)

    def test_kms_deny_not_flagged_as_public_bucket(self):
        headers = self._register_and_login()
        kms_deny = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Sid": "DenyObjectsThatAreNotSSEKMS",
                    "Principal": "*",
                    "Effect": "Deny",
                    "Action": "s3:PutObject",
                    "Resource": "arn:aws:s3:::amzn-s3-demo-bucket/*",
                    "Condition": {
                        "Null": {
                            "s3:x-amz-server-side-encryption-aws-kms-key-id": "true"
                        }
                    }
                }
            ]
        }
        data = {
            "file": (io.BytesIO(json.dumps(kms_deny).encode("utf-8")), "secure_s3_kms_deny.json")
        }
        res = self.client.post("/upload", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertEqual(res_json["findings_count"], 0)
        self.assertEqual(res_json["score"], 100)

    def test_yaml_upload_support(self):
        headers = self._register_and_login()
        yaml_content = b"""
Version: '2012-10-17'
Statement:
  - Effect: Allow
    Action: '*'
    Resource: '*'
"""
        data = {
            "files": (io.BytesIO(yaml_content), "policy.yaml")
        }
        res = self.client.post("/upload/batch", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(res.status_code, 200)
        upload_id = res.get_json()["results"][0]["upload_id"]
        findings = self.client.get(f"/findings/{upload_id}", headers=headers).get_json()
        self.assertGreater(len(findings), 0)
        self.assertEqual(findings[0]["category"], "IAM")

    def test_file_type_check_rejects_unsupported(self):
        headers = self._register_and_login()
        data = {
            "file": (io.BytesIO(b"malicious script"), "hack.sh")
        }
        res = self.client.post("/upload", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported file type", res.get_json()["error"])

    def test_password_reset_with_secrets_and_rate_limit(self):
        self.client.post("/signup", json={"email": "resetme@example.com", "password": "initialpassword"})
        res = self.client.post("/forgot-password", json={"email": "resetme@example.com"})
        self.assertEqual(res.status_code, 200)

        # Immediate second request should be rate limited (429)
        res_rate = self.client.post("/forgot-password", json={"email": "resetme@example.com"})
        self.assertEqual(res_rate.status_code, 429)

        # Check DB stored token
        with app.app_context():
            user = User.query.filter_by(email="resetme@example.com").first()
            token = PasswordResetToken.query.filter_by(user_id=user.id).first()
            self.assertIsNotNone(token)
            self.assertEqual(len(token.code_hash), 64)  # SHA-256


if __name__ == "__main__":
    unittest.main()

