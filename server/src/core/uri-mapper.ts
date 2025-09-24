const CONTAINER_LIFE_TIME = 1000 * 60 * 30;

/** @description Contains doc_uri and mapped workspace_uri.
 *
 * Implements self-deletion logic
 */
class UriMappingEntry {
  public readonly docUri: string;
  public readonly workspaceUri: string;

  private _removalTimeout: ReturnType<typeof setTimeout> | null = null;
  private _removeSelf: ( container: UriMappingEntry ) => void;

  constructor( docUri: string, workspaceUri: string, removeSelf: ( container: UriMappingEntry ) => void ) {
    this.docUri = docUri;
    this.workspaceUri = workspaceUri;
    this._removeSelf = removeSelf;
  }

  public clearDeletingTimeout(): void {
    if(this._removalTimeout) {
      clearTimeout(this._removalTimeout);
    }
  }

  public setRemovalTimeout(): void {
    this._removalTimeout = setTimeout(() => { this._removeSelf( this ); }, CONTAINER_LIFE_TIME);
  }
}

/** @description Maps workspace uri for doc uri. Cache pairs <workspace_uri, doc_uri> */
class UriMapper {
  /** @description keys are uri of documents */
  private readonly _docUriToWorkspaceMap = new Map<string, UriMappingEntry>();
  private readonly _workspaceUris: string[];

  constructor( workspaceUris: string[] ) {
    this._workspaceUris = workspaceUris;
  }

  /** @description Called on document openning to get corresponding workspace uri */
  public trackDocument( docUri: string ): void {
    const savedUriContainer = this._docUriToWorkspaceMap.get(docUri);

    if(savedUriContainer) {
      savedUriContainer.clearDeletingTimeout();
      return;
    }

    const workspaceUri = this._findWorkspaceUri( docUri );

    if(!workspaceUri) {
      return;
    }

    this._docUriToWorkspaceMap.set( docUri, new UriMappingEntry( docUri, workspaceUri, this._removeContainer.bind(this) ) );
  };

  private _findWorkspaceUri( docUri: string ): string | null {
    // If docUri contains workspaceUri, it means doc placed inside workspace
    let closestWorkspaceUri = '';
    for(const workspaceUri of this._workspaceUris) {
      if(docUri.includes( workspaceUri ) && workspaceUri.includes(closestWorkspaceUri)) {
        closestWorkspaceUri = workspaceUri;
      }
    }

    return closestWorkspaceUri || null;
  }

  private _removeContainer( workspaceContainer: UriMappingEntry ): void {
    this._docUriToWorkspaceMap.delete( workspaceContainer.docUri );
  }

  /** @description Called on document close to initialize saved workspace uri removal */
  public scheduleRemoval( docUri: string ): void {
    const container = this._docUriToWorkspaceMap.get( docUri );

    if(!container) { return; }

    container.setRemovalTimeout();
  }

  /** @description Get workspace uri for doc uri */
  public getWorkspaceUri(docUri: string) {
    const container = this._docUriToWorkspaceMap.get( docUri );

    if(!container) {
      return null;
    }

    return container.workspaceUri;
  }
}

let mapper: null | UriMapper = null;
export const initUriMapper = ( workspaces: string[] ) => {
  mapper = new UriMapper(workspaces);
};

export const getUriMapper = (  ) => {
  if(!mapper) {
    throw new Error('UriMapper was not initialized yet');
  }

  return { uriMapper: mapper };
};
