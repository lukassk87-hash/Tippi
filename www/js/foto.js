// www/foto.js
// Nimmt ein Foto mit Capacitor Camera auf und fügt es direkt als neues Frame hinzu.

(() => {
  'use strict';

  const photoBtn = document.getElementById('takePhotoBtn');
  const statusEl = document.getElementById('status');

  function log(msg) {
    if (statusEl) statusEl.textContent = msg;
    console.log('[foto.js]', msg);
  }

  async function blobFromWebPath(webPath) {
    const res = await fetch(webPath);
    if (!res.ok) {
      throw new Error(`Bild konnte nicht geladen werden (${res.status})`);
    }
    return await res.blob();
  }

  async function blobToBitmap(blob) {
    if (window.createImageBitmap) {
      return await createImageBitmap(blob);
    }

    return await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        resolve(img);
      };

      img.onerror = () => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        reject(new Error('Bild konnte nicht dekodiert werden'));
      };

      img.src = url;
    });
  }

  async function takePhotoAndAddFrame() {
    try {
      if (!window.Capacitor) {
        log('Capacitor nicht verfügbar');
        return;
      }

      const Camera = window.Capacitor?.Plugins?.Camera;
      if (!Camera || typeof Camera.getPhoto !== 'function') {
        log('Camera-Plugin nicht verfügbar');
        return;
      }

      const app = window.stopmotionApp;
      if (!app || typeof app.addBitmapFrame !== 'function') {
        log('Frame-API fehlt');
        return;
      }

      log('Kamera wird geöffnet ...');

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri'
      });

      if (!image || !image.webPath) {
        log('Kein Foto aufgenommen');
        return;
      }

      const blob = await blobFromWebPath(image.webPath);
      const bitmap = await blobToBitmap(blob);

      await app.addBitmapFrame(bitmap);

      if (typeof app.goToFrame === 'function') {
        await app.goToFrame(app.getFrameCount() - 1);
      }

      log(`Foto hinzugefügt. Frames: ${app.getFrameCount()}`);
    } catch (err) {
      console.error('[foto.js] takePhotoAndAddFrame failed', err);
      log('Fotoaufnahme abgebrochen oder fehlgeschlagen');
    }
  }

  if (photoBtn) {
    photoBtn.addEventListener('click', takePhotoAndAddFrame);
  }

  window.__fotoDebug = {
    takePhotoAndAddFrame
  };
})();