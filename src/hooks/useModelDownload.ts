import {useState, useCallback, useEffect} from 'react';
import {modelManager} from '../services/modelManager';
import {modelConfig} from '../config/loader';
import {getMode} from '../services/llmRouter';

export function useModelDownload() {
  // Demo mode skips the 2.4 GB download entirely and pretends the model
  // is already in place.
  const demoMode = getMode() === 'demo';
  const [isDownloaded, setDownloaded] = useState(demoMode);
  const [isDownloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelSizeMB, setModelSizeMB] = useState<number>(modelConfig.sizeMB ?? 2445);

  useEffect(() => {
    // Demo mode: skip real model check, pretend it's ready
    if (demoMode) return;

    let mounted = true;

    async function checkStatus() {
      const downloaded = await modelManager.isModelDownloaded();
      if (!mounted) {
        return;
      }
      setDownloaded(downloaded);

      if (downloaded) {
        const size = await modelManager.getModelSizeMB();
        if (mounted) {
          setModelSizeMB(Math.round(size));
        }
      }
    }

    checkStatus();

    return () => {
      mounted = false;
    };
  }, [demoMode]);

  const startDownload = useCallback(async () => {
    setDownloading(true);
    setProgress(0);

    try {
      await modelManager.downloadModel(p => {
        setProgress(p);
      });
      setDownloaded(true);

      const size = await modelManager.getModelSizeMB();
      setModelSizeMB(Math.round(size));
    } finally {
      setDownloading(false);
    }
  }, []);

  const deleteModel = useCallback(async () => {
    await modelManager.deleteModel();
    setDownloaded(false);
    setProgress(0);
    setModelSizeMB(modelConfig.sizeMB ?? 2445);
  }, []);

  return {
    isDownloaded,
    isDownloading,
    progress,
    startDownload,
    deleteModel,
    modelSizeMB,
  };
}
