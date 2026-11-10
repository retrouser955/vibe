import { startServer } from '@/server/server.ts';
import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';

let firstTime = true;

const handler: EventHandler<'clientReady'> = async (client) => {
  Logger.info(`Logged in as ${client.user.username}!`);
  if(firstTime) {
    startServer();
    firstTime = false;
  }
};

export default handler;
