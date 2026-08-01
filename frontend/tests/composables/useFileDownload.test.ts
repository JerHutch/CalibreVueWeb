import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from '@/api/axios';
import { useFileDownload } from '@/composables/useFileDownload';

vi.mock('@/api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('useFileDownload', () => {
  const mockedApi = vi.mocked(api);
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:test-url');
    URL.revokeObjectURL = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    console.error = originalConsoleError;
  });

  it('downloads a file and tracks progress', async () => {
    const progressUpdates: number[] = [];
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    mockedApi.get.mockImplementation(async (_url, config) => {
      config?.onDownloadProgress?.({ loaded: 25, total: 100 } as never);
      config?.onDownloadProgress?.({ loaded: 100, total: 100 } as never);
      return { data: new Blob(['file']) };
    });

    const { downloadFile, isDownloading, downloadError, downloadProgress } = useFileDownload();

    const result = await downloadFile('/books/1/download', {
      filename: 'Book.epub',
      onProgress: (progress) => progressUpdates.push(progress),
    });

    expect(result).toBe(true);
    expect(mockedApi.get).toHaveBeenCalledWith('/books/1/download', expect.objectContaining({
      responseType: 'blob',
      onDownloadProgress: expect.any(Function),
    }));
    expect(downloadProgress.value).toBe(100);
    expect(progressUpdates).toEqual([25, 100]);
    expect(downloadError.value).toBeNull();
    expect(isDownloading.value).toBe(false);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces download failures', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('network down'));

    const { downloadFile, isDownloading, downloadError, downloadProgress } = useFileDownload();

    const result = await downloadFile('/books/1/download');

    expect(result).toBe(false);
    expect(downloadError.value).toBe('network down');
    expect(downloadProgress.value).toBe(0);
    expect(isDownloading.value).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
