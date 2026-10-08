import { voxelShell } from './headfield.js';

self.onmessage = (e) => {
  const res = voxelShell(e.data.cell);
  self.postMessage({ res }, [res.buffer]);
};
