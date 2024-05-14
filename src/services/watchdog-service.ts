import { ChannelRepository, ProxyRepo } from "./db-service";
import { BotService } from "./bot-service";
import EventEmitter from "events";
import { writeFileSync, readFileSync, stat } from "fs";
import * as https from 'https';
import * as cheerio from 'cheerio';
import { getRandom } from 'random-useragent';
import { Proxy } from "../entity/proxy";

export enum Status {
  Idle = "Idle",
  Active = "Active"
}

export class ChannelsInfo {
  total: number = 0;
  dead: number = 0;
  alive: number = 0;
  exported: number = 0;
  unexported: number = 0;
}

export async function Delay(ms: number) {
  return new Promise((r) => setTimeout(() => { r(0) }, ms));
}

export module WatchdogService {
  export const stats = { total: 0, inprogress: 0, done: 0, error: 0, percent: 0};

  export async function getChannelsInfo() {
    const stats = new ChannelsInfo();

    stats.total = await ChannelRepository.count();
    stats.alive = await ChannelRepository.countBy({ IsDead: false });
    stats.dead = await ChannelRepository.countBy({ IsDead: true });
    stats.exported = await ChannelRepository.countBy({ Exported: true });
    stats.unexported = await ChannelRepository.countBy({ Exported: false });

    return stats;
  }
  export async function ClearAll() {
    try {
      return (await ChannelRepository.delete({})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearAll");
      console.log(err);
      return -1;
    }
  }
  export async function ClearDead() {
    try {
      return (await ChannelRepository.delete({IsDead: true})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearDead");
      console.log(err);
      return undefined;
    }
  }
  export async function ClearAlive() {
    try {
      return (await ChannelRepository.delete({IsDead: false})).affected;
    } catch (err) {
      console.log("[ERROR] WatchdogService:ClearAlive");
      console.log(err);
      return -1;
    }
  }

  export async function GetAllChannels() {
    try {
      return await ChannelRepository.find();
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetAllChannels");
      console.log(err);
      return [];
    }
  }
  export async function GetAliveChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetAliveChannels");
      console.log(err);
      return [];
    }
  }
  export async function GetDeadChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetDeadChannels");
      console.log(err);
      return [];
    }
  }

  export async function GetDeadUnexportChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true, Exported: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetDeadChannels");
      console.log(err);
      return [];
    }
  }

  export async function GetUnexportedChannels() {
    try {
      return await ChannelRepository.findBy({IsDead: true, Exported: false});
    } catch (err) {
      console.log("[ERROR] WatchdogService:GetUnexportedChannels");
      console.log(err);
      return [];
    }
  }

  export function AddChannels(username: string[]) {
    for (let x of username) {
      ChannelRepository.save({ username: x, IsDead: false, Exported: false })
    }
  }

  export async function parseProxy(proxies: string[]) {
    const proxyList: Proxy[] = proxies.map((proxy) => {
      const [username, password] = proxy.split('@')[0].split(':');
      const [ip, port] = proxy.split('@')[1].split(':');
      let p = new Proxy();
      p.ip = ip;
      p.password = password;
      p.port = parseInt(port, 10);
      p.username = username;
      return p;
    });
    return proxyList;
  }
  // username: without @
  // proxy: user:pass@ip:port
  async function performCheck(nicknames: string[], proxies: Proxy[]): Promise<{ [username: string]: boolean | null }> {
    stats.total = nicknames.length;
    stats.inprogress = nicknames.length;
    var results: { [username: string]: boolean | null } = {};

    for (const nickname of nicknames) {
      try {
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        const userAgent = getRandom();
        const options = {
          method: 'GET',
          hostname: 't.me',
          path: `/${nickname}`,
          headers: {
            'User-Agent': userAgent,
          },
          auth: `${proxy.username}:${proxy.password}`,
        };

        await new Promise((resolve) => setTimeout(resolve, 250));

        const req = https.request(options, (res) => {
          if (res.statusCode === 200) {
            var html = '';
            res.on('data', (chunk) => {
              html += chunk;
            });
            res.on('end', () => {
              var $ = cheerio.load(html);
              results[nickname] = $('body:contains("Preview channel")').length > 0;
            });
          } else {
            results[nickname] = null;
          }
        });

        req.on('error', () => {
          results[nickname] = null;
          stats.error++;
        });

        req.end();
      } catch (error) {
        console.log(`Error checking ${nickname}: ${(error as Error).message}`);
        results[nickname] = null;
        stats.error++;
      }
      stats.inprogress--;
      stats.done++;

      stats.percent = stats.done / stats.total;
    }

    return results;
  }

  export var checkStatus: Status = Status.Idle;
  export async function StartCheck() {
    if (checkStatus != Status.Idle) return;
    checkStatus = Status.Active;

    var usernames = (await ChannelRepository.findBy({ IsDead: false })).map(el => el.username);
    var proxies = await ProxyRepo.find();
    var result = await performCheck(usernames, proxies);

    var ents = Object.entries(result);
    var err = 0;
    var dead = 0;
    for (var el of ents) {
      await ChannelRepository.update({ username: el[0] }, { IsDead: el[1] === false });
      err += el[1] === null ? 1 : 0;
      dead += el[1] === false ? 1 : 0;
    }

    var stats = await getChannelsInfo();
    BotService.Broadcast(`👁‍🗨 Проверка завершена\nЖивые: ${stats.alive}\nМертвые: ${stats.dead}\nУмерло: ${dead}\nОшибка: ${err}`);

    checkStatus = Status.Idle;
  }
}