import * as dotenv from "dotenv";
dotenv.config();


// .env test
if (process.env.SKIP_ENV_CHECK?.toLowerCase() == 'false') {
  let skip = ['npm_config_noproxy', 'TZ', 'VSCODE_GIT_ASKPASS_EXTRA_ARGS'];
  let pairs = Object.entries(process.env);
  let err = false;
  let errtxt = "<.ENV ERROR>\n";
  for (let p of pairs) {
    if (p[1] == "" && !skip.includes(p[0])) {
      errtxt += `${p[0]}=${p[1]}\n`;
      err = true || err;
    }
  }
  if (err) {
    console.error(errtxt + "<CHECK .ENV>");
  }
}

import { existsSync, writeFileSync } from "fs";
if (!existsSync("./session")) writeFileSync("./session", "", 'utf8');

import { BotService } from "./services/bot-service";
import "./services/watchdog-service";
import "./services/db-service";
import "reflect-metadata";
import { WatchdogService } from "./services/watchdog-service";

//setTimeout(() => { BotService.Broadcast("Script running") }, 1000);