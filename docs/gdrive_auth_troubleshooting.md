# Google Drive OAuth Permission Troubleshooting (Production)

If your application is not prompting users for Google Drive permissions in production (as shown in the OAuth consent screen requesting only basic email and profile info), follow this troubleshooting guide to resolve the issue.

---

## 🔍 Why is Google Drive Permission Not Prompted?

In Google’s OAuth 2.0 system, if the scopes requested in the code (e.g. `https://www.googleapis.com/auth/drive.file`) are not displayed on the consent screen, it is typically due to one of the following reasons:

### 1. Google's Two-Screen Granular Consent Flow
Google utilizes a **two-screen granular consent flow** for applications requesting both sign-in (email, profile) and sensitive/restricted APIs (Google Drive):
* **Screen 1 (Basic Sign-In):** Prompts the user only for basic identity permissions (name, profile picture, email). **This is the screen shown in your screenshot.**
* **Screen 2 (API Permissions):** Once the user clicks **"Continue"** on the first screen, Google redirects them to a second page requesting checkboxes for specific **Google Drive** scopes. 

*Note: If clicking "Continue" logs you in directly without showing Screen 2, Google either automatically granted it from a previous login (revoke access at [myaccount.google.com/connections](https://myaccount.google.com/connections) to reset/test), or stripped the scopes due to the configuration issues below.*

### 2. Missing Scopes in Google Cloud Console
Google dynamically renders the OAuth consent screen based on the client configuration. If you request sensitive or restricted scopes in the code but have not explicitly configured them in your Google Cloud Console project, Google will silently strip/ignore them from the user prompt.

### 3. Google Drive API is Disabled
If the **Google Drive API** is not enabled in the API Library for the production project, the OAuth server will not allow authorization requests for Drive scopes.

### 4. Application Publishing Status (Testing vs. Production)
* **Testing Mode:** If the app’s publishing status is "Testing," only accounts listed as **Test Users** in the Google Cloud Console can access the requested scopes.
* **In Production (Unverified):** If the app is set to "In Production" but has not gone through Google’s Verification process for sensitive/restricted scopes, Google will block these scopes or prevent non-test users from authenticating.

---

## 🛠️ Step-by-Step Resolution

### Step 1: Enable the Google Drive API
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your production project.
3. Navigate to **APIs & Services > Library**.
4. Search for **Google Drive API** and click **Enable**.

### Step 2: Add Scopes to the Google Auth Platform (OAuth Consent Screen)
1. In the left sidebar of Google Cloud Console, click **APIs & Services > Google Auth Platform** (or **OAuth consent screen**).
2. Click **Edit App**.
3. Under the **Scopes** page, click **Add or Remove Scopes**.
4. Search and select the specific scopes used by the backend code:
   * `.../auth/drive.file` (Recommended: Only gives access to files created/opened by the app)
   * `.../auth/drive` (Restricted: Gives full access to all user files)
5. Save your changes.

### Step 3: Configure Test Users or Submit for Verification
* **If in Testing Status:** Ensure the test Gmail accounts (e.g., your developer or QA accounts) are explicitly added to the **Test Users** list under the OAuth Consent Screen dashboard.
* **If in Production Status:** You must submit the app for verification. Click **Submit for Verification** on the OAuth consent screen dashboard and complete the verification form (requires a privacy policy link and a demo video demonstrating scope usage).

> [!TIP]
> **Use Incremental Scopes:** Consider requesting only `https://www.googleapis.com/auth/drive.file` instead of the full `https://www.googleapis.com/auth/drive` scope. The `.file` scope is much easier to get verified and avoids strict restricted-scope requirements.
