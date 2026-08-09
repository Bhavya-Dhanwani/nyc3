import axios from "axios";

let googleToken = localStorage.getItem("autoshorts_google_token") || null;

export const setGoogleToken = (token) => {
  googleToken = token;
  if (token) {
    localStorage.setItem("autoshorts_google_token", token);
  } else {
    localStorage.removeItem("autoshorts_google_token");
  }
};

export const getGoogleToken = () => googleToken;

// Direct Google Drive API operations from the browser using the token
const driveApi = axios.create({
  baseURL: "https://www.googleapis.com"
});

driveApi.interceptors.request.use((config) => {
  const token = getGoogleToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Finds or creates the "AutoShorts Studio" folder
 */
export async function getOrCreateStudioFolder() {
  try {
    // 1. Search for existing folder
    const searchRes = await driveApi.get("/drive/v3/files", {
      params: {
        q: "name = 'AutoShorts Studio' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: "files(id, name)"
      }
    });

    const files = searchRes.data?.files || [];
    if (files.length > 0) {
      return files[0].id;
    }

    // 2. Create if not found
    const createRes = await driveApi.post("/drive/v3/files", {
      name: "AutoShorts Studio",
      mimeType: "application/vnd.google-apps.folder"
    });

    return createRes.data?.id;
  } catch (err) {
    console.error("Failed to get/create AutoShorts Studio folder:", err);
    throw new Error("Google Drive access failed. Please reconnect Google Drive.");
  }
}

/**
 * Finds or creates a project folder inside "AutoShorts Studio"
 */
export async function getOrCreateProjectFolder(projectName, cachedFolderId = null) {
  if (cachedFolderId) return cachedFolderId;

  try {
    const parentId = await getOrCreateStudioFolder();

    // 1. Search for project folder under parent
    const searchRes = await driveApi.get("/drive/v3/files", {
      params: {
        q: `name = '${projectName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id, name)"
      }
    });

    const files = searchRes.data?.files || [];
    if (files.length > 0) {
      return files[0].id;
    }

    // 2. Create if not found
    const createRes = await driveApi.post("/drive/v3/files", {
      name: projectName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    });

    return createRes.data?.id;
  } catch (err) {
    console.error(`Failed to get/create project folder "${projectName}":`, err);
    throw err;
  }
}

/**
 * Lists files in a specific Google Drive project folder
 */
export async function listFilesInFolder(folderId) {
  try {
    const res = await driveApi.get("/drive/v3/files", {
      params: {
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, thumbnailLink)",
        orderBy: "createdTime desc"
      }
    });
    return res.data?.files || [];
  } catch (err) {
    console.error(`Failed to list files for folder ${folderId}:`, err);
    return [];
  }
}

/**
 * Uploads a file Blob directly to the specified Google Drive project folder
 */
export async function uploadFileToFolder(folderId, fileName, fileBlob, mimeType) {
  try {
    const metadata = {
      name: fileName,
      parents: [folderId]
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    formData.append("file", fileBlob);

    const res = await driveApi.post("/upload/drive/v3/files?uploadType=multipart", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    return res.data;
  } catch (err) {
    console.error(`Failed to upload file "${fileName}" to Drive folder:`, err);
    throw err;
  }
}
