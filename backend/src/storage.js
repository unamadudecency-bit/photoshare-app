const config = require('./config');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

let uploadPhoto, deletePhoto;

if (config.useMocks) {
  console.log('🟡 Storage: using local filesystem (./uploads/)');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  uploadPhoto = async (buffer, mimeType, originalName) => {
    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
    const blobName = `${uuidv4()}.${ext}`;
    const filePath = path.join(uploadsDir, blobName);
    fs.writeFileSync(filePath, buffer);
    // We serve uploads as a static folder, so URL is /uploads/<filename>
    return { blobName, url: `/uploads/${blobName}` };
  };

  deletePhoto = async (blobName) => {
    const filePath = path.join(uploadsDir, blobName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  };
} else {
  console.log('🟢 Storage: using Azure Blob Storage');
  const { BlobServiceClient } = require('@azure/storage-blob');
  const blobService = BlobServiceClient.fromConnectionString(config.storage.connectionString);
  const container = blobService.getContainerClient(config.storage.container);

  uploadPhoto = async (buffer, mimeType, originalName) => {
    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase();
    const blobName = `${uuidv4()}.${ext}`;
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType }
    });
    return { blobName, url: blockBlob.url };
  };

  deletePhoto = async (blobName) => {
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.deleteIfExists();
  };
}

module.exports = { uploadPhoto, deletePhoto };