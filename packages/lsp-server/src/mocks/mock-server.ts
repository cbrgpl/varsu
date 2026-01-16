import * as http from 'http';

import { promises as fs } from 'fs';
import * as path from 'path';
import { cwd } from 'process';

const cssVariablesFilePromise = (async () => {
  const __dirname = path.dirname(cwd());
  const cssPath = path.resolve(__dirname, 'lsp-server/src/mocks/css-vars.css');

  const cssTextPromise = fs.readFile(cssPath);

  return cssTextPromise;
})();

enum EAvailableRoutes {
  CSS_SCHEMA = '/css',
  ROUTER_SCHEMA = '/router-schema'
}

const server = http.createServer(
  async function ( request, response ) {
    if(request.url === EAvailableRoutes.CSS_SCHEMA) {
      const cssVariablesFile = await cssVariablesFilePromise;
      response.end(cssVariablesFile);
    } else if(request.url === EAvailableRoutes.ROUTER_SCHEMA) {
      response.end();
    } else {
      response.end();
    }
  }
);

server.listen(3005);
