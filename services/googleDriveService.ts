
declare const gapi: any;
declare const google: any;

export class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private gisInited: boolean = false;

  // Accés segur a variables d'entorn per evitar crashes al navegador
  private getClientId(): string {
    if (typeof process !== 'undefined' && process.env) {
      return (process.env as any).GOOGLE_CLIENT_ID || '';
    }
    return '';
  }

  private getApiKey(): string {
    if (typeof process !== 'undefined' && process.env) {
      return (process.env as any).GOOGLE_API_KEY || process.env.API_KEY || '';
    }
    return '';
  }

  constructor() {
    // Inicialització buida per seguretat
  }

  private initGis() {
    if (typeof google === 'undefined' || !google.accounts) {
      throw new Error("La llibreria de Google Identity Services no s'ha carregat correctament.");
    }
    
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error("Falta el paràmetre 'GOOGLE_CLIENT_ID'. Configura-lo a les variables d'entorn del projecte.");
    }

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.error !== undefined) {
            throw response;
          }
          this.accessToken = response.access_token;
          this.createPicker();
        },
      });
      this.gisInited = true;
    } catch (e) {
      console.error("Error inicialitzant GIS:", e);
      throw e;
    }
  }

  private loadPicker() {
    return new Promise<void>((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error("La llibreria gapi no està disponible."));
        return;
      }
      gapi.load('picker', { 
        callback: resolve,
        onerror: () => reject(new Error("Error carregant Google Picker."))
      });
    });
  }

  async openPicker(onSelect: (content: string, fileName: string) => void): Promise<void> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error("ID de client de Google no configurat. Cal un 'GOOGLE_CLIENT_ID' vàlid a les variables d'entorn.");
    }

    if (!this.gisInited) {
      this.initGis();
    }
    
    await this.loadPicker();

    if (!this.accessToken) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      this.createPicker(onSelect);
    }
  }

  private async createPicker(onSelect?: (content: string, fileName: string) => void) {
    const apiKey = this.getApiKey();
    const clientId = this.getClientId();
    
    if (!apiKey) {
      console.warn("API_KEY de Google no trobada. El Picker podria fallar si no hi ha una clau vàlida.");
    }

    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/vnd.google-apps.document');

    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setDeveloperKey(apiKey)
      .setAppId(clientId)
      .setOAuthToken(this.accessToken)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setCallback(async (data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          const fileName = doc.name;
          const content = await this.fetchFileContent(doc);
          if (onSelect) onSelect(content, fileName);
        }
      })
      .build();
    picker.setVisible(true);
  }

  private async fetchFileContent(doc: any): Promise<string> {
    const fileId = doc.id;
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    if (doc.mimeType === 'application/vnd.google-apps.document') {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Error descarregant el fitxer de Drive');
      
      if (doc.mimeType === 'application/pdf') {
        return `[Contingut del PDF '${doc.name}' de Drive: L'extracció de text de PDFs des de Drive requereix permisos addicionals de descàrrega o un servei de processament intermedi.]`;
      }

      return await response.text();
    } catch (err) {
      console.error(err);
      return `[Error carregant el fitxer ${doc.name}]`;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
