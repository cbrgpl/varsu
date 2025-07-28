let _capabilitiesSetted = false;

type UCapabilities = 'config' | "workspaceFolder";

const _capabitiles: Record<UCapabilities, boolean> = {
  config: false,
  workspaceFolder: false,
};

export const capabilities = {
  set: (
    config: boolean,
    workspaceFolder: boolean,
  ) => {
    if(_capabilitiesSetted) { return; }
    _capabilitiesSetted = true;
    _capabitiles.config = config;
    _capabitiles.workspaceFolder = workspaceFolder;
  },
  has: ( capability: UCapabilities ) => _capabitiles[capability]
};
