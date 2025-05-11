import { ref } from 'vue';
import api from '@/api/axios';

interface DownloadOptions {
  filename?: string;
  onProgress?: (progress: number) => void;
}

export function useFileDownload() {
  const isDownloading = ref(false);
  const downloadError = ref<string | null>(null);
  const downloadProgress = ref(0);

  const downloadFile = async (url: string, options: DownloadOptions = {}) => {
    isDownloading.value = true;
    downloadError.value = null;
    downloadProgress.value = 0;

    try {
      const response = await api.get(url, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            downloadProgress.value = progress;
            options.onProgress?.(progress);
          }
        },
      });

      // Create a blob URL
      const blob = new Blob([response.data]);
      const downloadUrl = URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = options.filename || 'download';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      return true;
    } catch (error) {
      downloadError.value = error instanceof Error ? error.message : 'Failed to download file';
      console.error('Download error:', error);
      return false;
    } finally {
      isDownloading.value = false;
    }
  };

  return {
    isDownloading,
    downloadError,
    downloadProgress,
    downloadFile,
  };
} 