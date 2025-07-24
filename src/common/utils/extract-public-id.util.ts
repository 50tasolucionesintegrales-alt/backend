export function extractPublicId(url: string): string | null {
    // Ejemplo de URL:
    // https://res.cloudinary.com/<cloud>/image/upload/v16812345/folder/file_xyz.jpg
    try {
        const parts = url.split('/upload/')[1]; // v16812345/folder/file_xyz.jpg
        if (!parts) return null;
        const withoutVersion = parts.replace(/^v\d+\//, ''); // folder/file_xyz.jpg
        const publicId = withoutVersion.replace(/\.[^/.]+$/, ''); // folder/file_xyz
        return publicId;
    } catch {
        return null;
    }
}
