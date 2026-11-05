import os
import sys
import json
import io
import tempfile
import unittest

# Isolate test database from development / production database
TEST_DB_PATH = os.path.join(tempfile.gettempdir(), f"csa_test_{os.getpid()}.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["FLASK_TESTING"] = "true"
os.environ["FLASK_DEBUG"] = "true"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-for-unit-tests"
os.environ["FLASK_SECRET_KEY"] = "test-flask-secret-key-for-unit-tests"

# Add backend to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import app, db, User, Upload, Finding, PasswordResetToken


class CloudSecureAdvisorTestCase(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass

    def setUp(self):
        app.config["TESTING"] = True
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

    def test_compliance_endpoint_empty_and_evaluated(self):
        headers = self._register_and_login()

        # 1. When no uploads exist, compliance returns has_data: False and score: 0
        empty_res = self.client.get("/compliance", headers=headers)
        self.assertEqual(empty_res.status_code, 200)
        empty_data = empty_res.get_json()
        self.assertFalse(empty_data["has_data"])
        self.assertEqual(empty_data["overall_score"], 0)
        self.assertIn("nist_800_53", empty_data["frameworks"])
        self.assertEqual(empty_data["frameworks"]["nist_800_53"]["total_controls"], 13)

        # 2. Upload policy with wildcard permissions
        sample_iam = {
            "Version": "2012-10-17",
            "Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*"}]
        }
        data = {
            "files": (io.BytesIO(json.dumps(sample_iam).encode("utf-8")), "admin_role.json")
        }
        up_res = self.client.post("/upload/batch", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(up_res.status_code, 200)
        upload_id = up_res.get_json()["results"][0]["upload_id"]

        # 3. Compliance now has data and evaluates failures
        comp_res = self.client.get("/compliance", headers=headers)
        self.assertEqual(comp_res.status_code, 200)
        comp_data = comp_res.get_json()
        self.assertTrue(comp_data["has_data"])

        nist = comp_data["frameworks"]["nist_800_53"]
        self.assertGreater(nist["failing_controls"], 0)
        failing_ids = [c["id"] for c in nist["controls"] if c["status"] == "FAIL"]
        self.assertIn("AC-3", failing_ids)
        self.assertIn("AC-6", failing_ids)

        cis = comp_data["frameworks"]["cis_aws_benchmark"]
        cis_failing = [c["id"] for c in cis["controls"] if c["status"] == "FAIL"]
        self.assertIn("CIS 1.16", cis_failing)

        soc2 = comp_data["frameworks"]["soc2_type_ii"]
        soc2_failing = [c["id"] for c in soc2["controls"] if c["status"] == "FAIL"]
        self.assertIn("CC6.1", soc2_failing)
        self.assertIn("CC6.3", soc2_failing)

        # 4. Filter by upload_id
        filtered_res = self.client.get(f"/compliance?upload_id={upload_id}", headers=headers)
        self.assertEqual(filtered_res.status_code, 200)
        filtered_data = filtered_res.get_json()
        self.assertTrue(filtered_data["has_data"])

    def test_batch_upload_file_count_cap(self):
        headers = self._register_and_login()
        files = [
            (io.BytesIO(b'{"Version":"2012-10-17","Statement":[]}'), f"policy_{i}.json")
            for i in range(21)
        ]
        data = {"files": files}
        res = self.client.post("/upload/batch", data=data, content_type="multipart/form-data", headers=headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Batch upload limit exceeded", res.get_json()["error"])

    def test_account_profile_update_and_delete(self):
        email = "user_settings@example.com"
        password = "original_password123"
        headers = self._register_and_login(email=email, password=password)

        # 1. Fetch profile
        res_get = self.client.get("/account", headers=headers)
        self.assertEqual(res_get.status_code, 200)
        profile = res_get.get_json()
        self.assertEqual(profile["email"], email)
        self.assertEqual(profile["total_scans"], 0)

        # 2. Update password - fail with wrong current password
        bad_pw_res = self.client.put(
            "/account",
            json={"current_password": "wrong_password", "new_password": "brand_new_password123"},
            headers=headers
        )
        self.assertEqual(bad_pw_res.status_code, 401)

        # 3. Update password - succeed
        good_pw_res = self.client.put(
            "/account",
            json={"current_password": password, "new_password": "brand_new_password123"},
            headers=headers
        )
        self.assertEqual(good_pw_res.status_code, 200)

        # Verify login works with new password
        login_res = self.client.post(
            "/login",
            json={"email": email, "password": "brand_new_password123"}
        )
        self.assertEqual(login_res.status_code, 200)
        new_token = login_res.get_json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # 4. Update email
        email_res = self.client.put(
            "/account",
            json={"email": "new_email@example.com", "current_password": "brand_new_password123"},
            headers=new_headers
        )
        self.assertEqual(email_res.status_code, 200)
        self.assertEqual(email_res.get_json()["email"], "new_email@example.com")

        # 5. Delete account
        del_fail = self.client.delete(
            "/account",
            json={"password": "wrong_password"},
            headers=new_headers
        )
        self.assertEqual(del_fail.status_code, 401)

        del_ok = self.client.delete(
            "/account",
            json={"password": "brand_new_password123"},
            headers=new_headers
        )
        self.assertEqual(del_ok.status_code, 200)

        # Verify user is gone
        login_after_del = self.client.post(
            "/login",
            json={"email": "new_email@example.com", "password": "brand_new_password123"}
        )
        self.assertEqual(login_after_del.status_code, 401)

    def test_personal_profile_complete_page_and_settings(self):
        # 1. New user signup returns access_token and empty profile fields
        signup_res = self.client.post(
            "/signup",
            json={"email": "newbie@example.com", "password": "securepassword123"}
        )
        self.assertEqual(signup_res.status_code, 201)
        signup_json = signup_res.get_json()
        self.assertIn("access_token", signup_json)
        self.assertEqual(signup_json["user"]["email"], "newbie@example.com")
        self.assertIsNone(signup_json["user"]["first_name"])

        headers = {"Authorization": f"Bearer {signup_json['access_token']}"}

        # 2. Complete Profile Page flow: PUT /account with personal details (no password needed)
        comp_res = self.client.put(
            "/account",
            json={
                "first_name": "Ada",
                "last_name": "Lovelace",
                "dob": "1815-12-10",
                "phone": "+1-800-555-0199",
            },
            headers=headers
        )
        self.assertEqual(comp_res.status_code, 200)
        profile_data = comp_res.get_json()["profile"]
        self.assertEqual(profile_data["first_name"], "Ada")
        self.assertEqual(profile_data["last_name"], "Lovelace")
        self.assertEqual(profile_data["dob"], "1815-12-10")
        self.assertEqual(profile_data["phone"], "+1-800-555-0199")

        # 3. GET /account returns complete profile details
        get_res = self.client.get("/account", headers=headers)
        self.assertEqual(get_res.status_code, 200)
        account = get_res.get_json()
        self.assertEqual(account["first_name"], "Ada")
        self.assertEqual(account["last_name"], "Lovelace")
        self.assertEqual(account["dob"], "1815-12-10")
        self.assertEqual(account["phone"], "+1-800-555-0199")

        # 4. Settings Page update: update only phone number
        edit_res = self.client.put(
            "/account",
            json={"phone": "+1-800-555-9999"},
            headers=headers
        )
        self.assertEqual(edit_res.status_code, 200)
        updated_profile = edit_res.get_json()["profile"]
        self.assertEqual(updated_profile["first_name"], "Ada")
        self.assertEqual(updated_profile["phone"], "+1-800-555-9999")


if __name__ == "__main__":
    unittest.main()

