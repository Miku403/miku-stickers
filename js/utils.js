export function blobToBase64(blob) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const result = reader.result;

      resolve(
        result.split(",")[1]
      );
    };

    reader.onerror = reject;

    reader.readAsDataURL(blob);
  });
}


export function formatBytes(bytes) {

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
