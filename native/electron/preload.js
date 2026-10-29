// Gives the web app the story-writer engine, with the same calls as the Android LocalLlm plugin.
const { contextBridge, ipcRenderer } = require('electron');

const listeners = {};
ipcRenderer.on('llm-event', (_e, { event, data }) => (listeners[event] || []).forEach(f => f(data)));
// Errors cross IPC as "Error invoking remote method 'llm:x': Error: …"; keep the readable part.
const call = name => args => ipcRenderer.invoke('llm:' + name, args).catch(err => {
  throw new Error(String(err.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
});

contextBridge.exposeInMainWorld('bitschoolNative', {
  llm: {
    info: call('info'), download: call('download'), cancelDownload: call('cancelDownload'), remove: call('remove'),
    loadModel: call('loadModel'), generate: call('generate'), stop: call('stop'), unload: call('unload'),
    addListener(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return Promise.resolve({ remove() { listeners[event] = listeners[event].filter(f => f !== fn); } });
    },
  },
});
