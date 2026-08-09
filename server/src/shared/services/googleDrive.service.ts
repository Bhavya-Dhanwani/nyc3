import { google } from "googleapis";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import fs from "fs";

class GoogleDriveService {

    // returns OAuth2 client configured with user's access/refresh tokens
    getUserDriveClient(accessToken: string, refreshToken?: string) {
        const oauth2Client = new google.auth.OAuth2(
            env.GOOGLE_CLIENT_ID,
            env.GOOGLE_CLIENT_SECRET,
            env.GOOGLE_REDIRECT_URI
        );
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        return google.drive({ version: "v3", auth: oauth2Client });
    }

    // ensures user access token is active; auto-refreshes using refresh token if expired
    async getValidUserToken(user: any): Promise<string | null> {
        if (!user.googleAccessToken) return null;
        
        // If there's no refresh token, we just return the access token we have
        if (!user.googleRefreshToken) return user.googleAccessToken;

        try {
            const oauth2Client = new google.auth.OAuth2(
                env.GOOGLE_CLIENT_ID,
                env.GOOGLE_CLIENT_SECRET,
                env.GOOGLE_REDIRECT_URI
            );
            oauth2Client.setCredentials({
                access_token: user.googleAccessToken,
                refresh_token: user.googleRefreshToken
            });

            // getAccessToken automatically refreshes if expired
            const response = await oauth2Client.getAccessToken();
            const token = response.token;
            
            if (token && token !== user.googleAccessToken) {
                user.googleAccessToken = token;
                await user.save();
                logger.info(`GoogleDriveService: Automatically refreshed and saved Google Access Token for user ${user._id}`);
            }
            return token || user.googleAccessToken;
        } catch (err: any) {
            logger.warn(`GoogleDriveService: Token refresh failed for user ${user._id}: ${err.message}`);
            return user.googleAccessToken;
        }
    }

    // returns JWT client configured with centralized service account credentials
    getCentralDriveClient() {
        if (!env.GDRIVE_SERVICE_ACCOUNT_KEY) {
            return null;
        }
        try {
            const credentials = JSON.parse(env.GDRIVE_SERVICE_ACCOUNT_KEY);
            const auth = new google.auth.JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: ["https://www.googleapis.com/auth/drive"]
            });
            return google.drive({ version: "v3", auth });
        } catch (err: any) {
            logger.error(`GoogleDriveService: Central Service Account init failed: ${err.message}`);
            return null;
        }
    }

    // finds or creates a specific folder by name
    async findOrCreateFolder(drive: any, folderName: string, parentId?: string): Promise<string> {
        try {
            let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
            if (parentId) {
                q += ` and '${parentId}' in parents`;
            }
            const response = await drive.files.list({
                q,
                fields: "files(id, name)",
                spaces: "drive",
            });
            const files = response.data.files || [];
            if (files.length > 0) {
                return files[0].id;
            }

            // Create new folder
            const fileMetadata = {
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
                parents: parentId ? [parentId] : undefined,
            };
            const folder = await drive.files.create({
                requestBody: fileMetadata,
                fields: "id",
            });
            logger.info(`GoogleDriveService: Created folder "${folderName}" (ID: ${folder.data.id})`);
            return folder.data.id;
        } catch (err: any) {
            logger.error(`GoogleDriveService: findOrCreateFolder error: ${err.message}`);
            throw err;
        }
    }

    // Centralized helper ensuring EXACTLY: AutoShorts Studio/{projectName}/ hierarchy
    async getOrCreateProjectFolder(drive: any, projectName: string, existingFolderId?: string): Promise<string> {
        try {
            // Verify existing cached folder ID
            if (existingFolderId) {
                try {
                    const check = await drive.files.get({
                        fileId: existingFolderId,
                        fields: "id, trashed"
                    });
                    if (check.data?.id && !check.data.trashed) {
                        return check.data.id;
                    }
                } catch {
                    // Folder no longer exists, will recreate below
                }
            }

            const rootFolderId = await this.findOrCreateFolder(drive, "AutoShorts Studio");
            const cleanProjectName = (projectName || "Untitled Project").trim();
            const projectFolderId = await this.findOrCreateFolder(drive, cleanProjectName, rootFolderId);
            return projectFolderId;
        } catch (err: any) {
            logger.error(`GoogleDriveService: getOrCreateProjectFolder error: ${err.message}`);
            throw err;
        }
    }

    // uploads a file to a specific Drive client (user or central)
    async uploadFile(
        drive: any,
        localPath: string,
        filename: string,
        mimeType: string,
        folderName = "AutoShorts Studio",
        onProgress?: (progress: { loaded: number; total: number }) => void,
        parentFolderId?: string
    ): Promise<{ fileId: string; webViewLink?: string } | null> {
        try {
            if (!fs.existsSync(localPath)) {
                throw new Error(`Local file not found: ${localPath}`);
            }

            // Find or create application folder if parentFolderId is not supplied
            const folderId = parentFolderId || await this.findOrCreateFolder(drive, folderName);

            const fileMetadata = {
                name: filename,
                parents: [folderId],
            };

            const media = {
                mimeType: mimeType,
                body: fs.createReadStream(localPath),
            };

            const fileSize = fs.statSync(localPath).size;

            const file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, webViewLink",
            }, {
                onUploadProgress: (evt: any) => {
                    if (onProgress) {
                        onProgress({ loaded: evt.bytesRead, total: fileSize });
                    }
                }
            });

            logger.info(`GoogleDriveService: Uploaded file "${filename}" to Drive folder "${folderName}" (ID: ${file.data.id})`);

            // Share file link to anyone if centralized, or just return private link
            return {
                fileId: file.data.id,
                webViewLink: file.data.webViewLink
            };
        } catch (err: any) {
            logger.error(`GoogleDriveService: uploadFile failed: ${err.message}`);
            return null;
        }
    }

    // downloads a file from Drive by ID to a local destination
    async downloadFile(drive: any, fileId: string, destPath: string): Promise<string> {
        try {
            const dest = fs.createWriteStream(destPath);
            const response = await drive.files.get(
                { fileId: fileId, alt: "media" },
                { responseType: "stream" }
            );
            return new Promise((resolve, reject) => {
                response.data
                    .on("end", () => {
                        resolve(destPath);
                    })
                    .on("error", (err: any) => {
                        reject(err);
                    })
                    .pipe(dest);
            });
        } catch (err: any) {
            logger.error(`GoogleDriveService: downloadFile failed: ${err.message}`);
            throw err;
        }
    }

    // deletes a file from Drive by ID
    async deleteFile(drive: any, fileId: string): Promise<boolean> {
        try {
            await drive.files.delete({ fileId });
            logger.info(`GoogleDriveService: Deleted file ID ${fileId}`);
            return true;
        } catch (err: any) {
            logger.warn(`GoogleDriveService: deleteFile failed for ${fileId}: ${err.message}`);
            return false;
        }
    }

    // moves a file to a target folder
    async moveFile(drive: any, fileId: string, targetFolderId: string): Promise<boolean> {
        try {
            const file = await drive.files.get({
                fileId: fileId,
                fields: "parents"
            });
            const previousParents = file.data.parents || [];
            
            await drive.files.update({
                fileId: fileId,
                addParents: targetFolderId,
                removeParents: previousParents.join(","),
                fields: "id, parents"
            });
            return true;
        } catch (err: any) {
            logger.error(`GoogleDriveService: moveFile failed: ${err.message}`);
            return false;
        }
    }

    // lists all files in a specific Google Drive folder
    async listFilesInFolder(drive: any, folderId: string) {
        try {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: "files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, thumbnailLink)",
                orderBy: "createdTime desc"
            });
            return res.data.files || [];
        } catch (err: any) {
            logger.error(`GoogleDriveService: listFilesInFolder failed for ${folderId}: ${err.message}`);
            return [];
        }
    }
}

export default GoogleDriveService;
